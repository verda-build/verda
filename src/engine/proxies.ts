import {
	ITargetExec,
	IResolver,
	ITargetIs,
	ModifiedCheckStatus,
	ArgList,
	ITargetCheckModification,
	BuildStatus
} from "./interfaces";
import Target from "./target";
import * as equal from "fast-deep-equal";
import { Rule } from "./rule";
import ParsedPath from "./parse-path";

export type RuleCandidate = { rule: Rule; m: string[] };

export class TargetIs implements ITargetIs {
	private target: Target;
	constructor(target: Target) {
		this.target = target;
	}

	placid() {
		this.target.volatile = false;
	}
	volatile() {
		this.target.volatile = true;
	}
	modified() {
		this.target.modified = ModifiedCheckStatus.YES;
	}
	updatedAt(time: Date) {
		this.target.setUpdated(time);
	}
}

const runningDependencies: WeakMap<IResolver<Target>, WeakMap<Target, Set<Target>>> = new WeakMap();

function getRD<T, G extends object, R extends object>(
	proxies: WeakMap<R, WeakMap<G, T>>,
	ctor: new () => T,
	target: G,
	resolver: R
) {
	if (proxies.has(resolver) && proxies.get(resolver).has(target)) {
		return proxies.get(resolver).get(target);
	} else {
		const proxy = new ctor();
		if (!proxies.has(resolver)) proxies.set(resolver, new WeakMap<G, T>());
		proxies.get(resolver).set(target, proxy);
		return proxy;
	}
}

export class ETargetProxy implements ITargetExec {
	private target: Target;
	private resolver: IResolver<Target>;
	is: ITargetIs;
	readonly path: ParsedPath;

	constructor(target: Target, resolver: IResolver<Target>) {
		this.target = target;
		this.resolver = resolver;
		this.is = new TargetIs(target);
		this.path = new ParsedPath(target.id);
	}

	// Clear the runningDependencies for new session
	static clear(resolver: IResolver<Target>) {
		runningDependencies.set(resolver, new WeakMap());
	}

	// EDSL directives
	get id() {
		return this.target.id;
	}
	toString() {
		return this.path.full;
	}
	toJSON() {
		return this.path.full;
	}
	get tracking() {
		return this.target.tracking;
	}
	track<T>(x: T): T {
		return this.target.track(x);
	}
	trackModification(x, compare = equal) {
		if (!compare(this.tracking, x)) this.is.modified();
		this.track(x);
		return x;
	}

	private trackMap(args: ArgList<Target>): any[] {
		const ans: any[] = [];
		for (const arg of args) {
			if (typeof arg === "string") {
				ans.push(this.resolveTarget(arg).lastReturned);
			} else if (arg instanceof Target) {
				ans.push(arg.lastReturned);
			} else {
				ans.push(this.trackMap([...arg]));
			}
		}
		return ans;
	}

	private flatten(args: ArgList<Target>, out: Set<Target>) {
		for (const arg of args) {
			if (typeof arg === "string") out.add(this.resolveTarget(arg));
			else if (arg instanceof Target) out.add(arg);
			else {
				this.flatten([...arg], out);
			}
		}
	}

	private collectAllDeps(t: Target, s: Set<Target>) {
		if (s.has(t)) return;
		s.add(t);
		const rd = getRD<Set<Target>, Target, IResolver<Target>>(
			runningDependencies,
			Set,
			this.target,
			this.resolver
		);
		for (const target of rd) {
			this.collectAllDeps(target, s);
		}
	}

	private checkCircular(deps: Iterable<Target>) {
		let allDeps = new Set();
		for (const t of deps) {
			this.collectAllDeps(t, allDeps);
			if (allDeps.has(this)) {
				throw new Error(
					`Circular dependency when building ${this.target.id}, depending on ${t.id}.`
				);
			}
		}
	}

	private resolveTarget(t: string | Target): Target {
		if (typeof t === "string") return this.resolver.query(t);
		else return t;
	}

	private async _ordered(deps: Set<Target>): Promise<void> {
		const rd = getRD<Set<Target>, Target, IResolver<Target>>(
			runningDependencies,
			Set,
			this.target,
			this.resolver
		);
		for (const d of deps) rd.add(d);
		this.checkCircular(deps);
		const dependencyPromises = [...deps].map(t => this.resolver.buildTarget(t));
		await Promise.all(dependencyPromises);
	}

	async order(...args: ArgList<Target>) {
		let deps: Set<Target> = new Set();
		this.flatten(args, deps);
		await this._ordered(deps);
		return this.trackMap(args);
	}

	private _needed(deps: Set<Target>) {
		if (deps.size) this.target.dependencies.push(deps);
	}

	needed(...args: ArgList<Target>) {
		let deps: Set<Target> = new Set();
		this.flatten(args, deps);
		this._needed(deps);
	}

	async need(...args: ArgList<Target>): Promise<any[]> {
		let deps: Set<Target> = new Set();
		this.flatten(args, deps);
		await this._ordered(deps);
		this._needed(deps);
		return this.trackMap(args);
	}
}

export class MCTargetProxy implements ITargetCheckModification {
	private target: Target;
	private resolver: IResolver<Target>;
	private ruleCandidate: RuleCandidate;
	private anyModified = false;
	constructor(target: Target, resolver: IResolver<Target>, rc: RuleCandidate) {
		this.target = target;
		this.resolver = resolver;
		this.ruleCandidate = rc;
	}

	get id() {
		return this.target.id;
	}
	toString() {
		return this.target.id;
	}
	get dependencies() {
		return this.target.dependencies;
	}
	get implicitDependencies() {
		return this.target.implicitDependencies;
	}
	get volatile() {
		return this.target.volatile;
	}
	get tracking() {
		return this.target.tracking;
	}
	get updated() {
		return this.target.updated;
	}

	async dependencyModified() {
		if (this.anyModified) return true;
		for (const group of [this.target.implicitDependencies, ...this.target.dependencies]) {
			const deps = [...group];
			let triggered = [];
			try {
				triggered = await Promise.all(
					deps.map(dep => this.resolver.checkModified(dep, this.target))
				);
			} catch (e) {
				return (this.anyModified = true);
			}
			for (let j = 0; j < deps.length; j++) {
				if (!triggered[j]) continue;
				this.resolver.reporter.debug(
					"Triggered Update:",
					this.target.id,
					"<==",
					deps[j].id
				);
				return (this.anyModified = true);
			}
		}
		return false;
	}

	startBuildEarly() {
		this.resolver.reporter.debug("Started early cutoff execute:", this.target.id);
		const proxy = new ETargetProxy(this.target, this.resolver);
		return this.target.start(this.ruleCandidate.rule.kind, async () =>
			this.ruleCandidate.rule.exec(proxy, ...this.ruleCandidate.m)
		);
	}

	cutoffEarly() {
		return this.startBuildEarly().then(x => this.target.modified === ModifiedCheckStatus.YES);
	}
}

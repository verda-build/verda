import Semaphore from "semaphore-async-await";

import { Reporter } from "../reporter";
import { QuietReporter } from "../reporter/quiet";

import {
	Arbitrator,
	BuildStatus,
	ExtBuildContext,
	Goal,
	Json,
	OrderGoalTypeList,
	PreBuildContext,
	PreBuildResult,
	PreBuildStatus,
	PrimOrderGoalType,
	Progress,
	Rule
} from "./interface";
import ProgressImpl from "./progress-impl";

interface Objective<A extends any[]> {
	goal: Goal<any, A>;
	matchResult: A;
	progress: ProgressImpl<Json>;
}

export function SleepPromise(dt: number) {
	return new Promise<null>(resolve => {
		setTimeout(() => resolve(null), dt);
	});
}

export default class Director implements Arbitrator {
	public reporter: Reporter = new QuietReporter();

	private rules: Rule<any, any>[] = [];
	private database: Map<string, Objective<any>> = new Map();
	private journal: Map<string, ProgressImpl<Json>> = new Map();
	private someTargetWrong = false;

	buildRev: number = 0;

	private updateBuildRev() {
		let rev: number = this.buildRev;
		for (let r of this.journal.values()) {
			if (r.revision > rev) rev = r.revision;
		}
		this.buildRev = rev + 1;
	}

	private createObjective(matchResult: string[], goal: Goal<Json, any>): Objective<any> {
		const progress = this.getProgress(goal.id);
		progress.isUser = goal.rule.isUser;
		return {
			matchResult,
			goal,
			progress
		};
	}

	private createProgress(goalID: string): ProgressImpl<any> {
		return new ProgressImpl<any>(goalID);
	}

	ruleNotFound(id: string) {
		return new Error(`Building rule for ${id} is not found.`);
	}
	dependencyNotFound(id: string, against: string) {
		return new Error(`Building rule for ${id} is not found, which is needed by ${against}.`);
	}
	tryToBuildWithDifferentRule(id: string) {
		return new Error(`Trying to build objective ${id} with a different rule.`);
	}
	cancelled(id: string) {
		return new Error(`Build for ${id} is cancelled.`);
	}

	getProgress(goalID: string) {
		const existing = this.journal.get(goalID);
		if (existing) return existing;
		const p = this.createProgress(goalID);
		this.journal.set(goalID, p);
		return p;
	}

	queryGoalFromString(isName: boolean, name: string) {
		const cached = isName ? null : this.database.get(name);
		if (cached) return cached;
		for (let j = this.rules.length - 1; j >= 0; j--) {
			const rule = this.rules[j];
			const id = isName ? rule.createGoalID(name) : name;
			const m = isName ? rule.matchString(name) : rule.matchGoalID(id);
			if (m) {
				const goal = { id, rule };
				const cached = this.database.get(id);
				if (cached && cached.goal.rule === rule) return cached;
				if (cached && cached.goal.rule !== rule) throw this.tryToBuildWithDifferentRule(id);
				const entry = this.createObjective(m, goal);
				this.database.set(id, entry);
				return entry;
			}
		}
		// no match, return undefined
		return undefined;
	}

	validateGoal<A extends any[]>(goal: Goal<any, A>): undefined | Objective<A> {
		const cached = this.database.get(goal.id);
		if (cached) {
			if (cached.goal.rule === goal.rule) {
				return cached;
			} else {
				throw this.tryToBuildWithDifferentRule(goal.id);
			}
		}

		const m = goal.rule.matchGoalID(goal.id);
		if (!m) return undefined;

		const entry = this.createObjective(m, goal);
		this.database.set(goal.id, entry);
		return entry;
	}

	private checkNeedRebuild<A extends any[]>(dep: Objective<A>) {
		if (dep.progress.preBuildStatus !== PreBuildStatus.UNKNOWN) {
			return dep.progress.modifiedCheckFinishPromise();
		} else {
			const proxy = new PreBuildContextImpl(dep, this);
			return dep.progress.startModifiedCheck(() => {
				return dep.goal.rule.preBuild(proxy, ...dep.matchResult);
			});
		}
	}

	async checkTriggerRebuildByDependency<A extends any[]>(
		dep: Objective<A>,
		against: Objective<A>
	): Promise<boolean> {
		const itselfModified = await this.checkNeedRebuild(dep);
		switch (itselfModified) {
			case PreBuildResult.TIME:
				return dep.progress.revision > against.progress.revision;
			case PreBuildResult.YES:
				return true;
			case PreBuildResult.NO:
				return false;
		}
	}

	async materialBuildNewTarget<A extends any[]>(target: Objective<A>) {
		const proxy = new BuildContextImpl(target, this);
		let r = undefined;
		try {
			r = await target.progress.start(this, async () => {
				return await target.goal.rule.build(proxy, ...target.matchResult);
			});
		} catch (e) {
			this.someTargetWrong = true;
			throw e;
		}
		return r;
	}

	private async buildNewTarget<A extends any[]>(target: Objective<A>) {
		if (this.someTargetWrong) throw this.cancelled(target.goal.id);
		if ((await this.checkNeedRebuild(target)) !== PreBuildResult.YES) {
			if (target.goal.rule.isUser) this.reporter.targetSkip(target.goal.id);
			return target.progress.result;
		} else {
			return this.materialBuildNewTarget(target);
		}
	}

	buildTarget<A extends any[]>(target: Objective<A>): Promise<any> {
		if (target.progress.status !== BuildStatus.NOT_STARTED) {
			return target.progress.finishPromise();
		} else {
			return this.buildNewTarget(target);
		}
	}

	async want(...args: OrderGoalTypeList) {
		this.updateBuildRev();
		let deps: Set<Objective<any>> = new Set();
		getObjectivesOfDepArgs(this, null, args, deps);
		await Promise.all([...deps].map(dep => this.buildTarget(dep)));
		return getResultsOfDepArgs(this, null, args);
	}

	addRule<T, A extends any[]>(rule: Rule<T, A>) {
		this.rules.push(rule);
	}

	invalidateJournal() {
		this.database = new Map();
		this.journal = new Map();
		this.reset();
	}

	reset() {
		this.someTargetWrong = false;
		for (const p of this.journal.values()) {
			p.resetBuildStatus();
		}
	}

	fromJson(json: any) {
		for (const id in json) {
			const p = this.getProgress(id);
			p.fromJson(json[id]);
		}
	}

	toJson(): any {
		const o: any = {};
		for (const [id, prog] of this.journal) {
			if (prog.status === BuildStatus.FINISHED || prog.status === BuildStatus.NOT_STARTED) {
				o[id] = prog.toJson();
			}
		}
		return o;
	}

	private lock: Semaphore | null = null;

	setCapacity(cap: number) {
		this.lock = new Semaphore(cap);
	}
	async start<T>(p: Progress<T>) {
		if (p.isUser) this.reporter.targetStart(p.id);
		if (p.isUser) this.reporter.targetHalt(p.id);
		if (this.lock && p.isUser) await this.lock.acquire();
		if (p.isUser) this.reporter.targetUnHalt(p.id);
		await SleepPromise(0);
	}
	async end<T>(p: Progress<T>, err: null | Error) {
		if (this.lock && p.isUser) this.lock.release();
		if (p.isUser) {
			if (err) {
				this.reporter.targetError(p.id, err);
			} else {
				this.reporter.targetEnd(p.id);
			}
		}
		await SleepPromise(0);
	}
	async unhalt<T>(p: Progress<T>) {
		if (this.lock && p.isUser) await this.lock.acquire();
		if (p.isUser) this.reporter.targetUnHalt(p.id);
		await SleepPromise(0);
	}
	async halt<T>(p: Progress<T>) {
		if (this.lock && p.isUser) this.lock.release();
		if (p.isUser) this.reporter.targetHalt(p.id);
		await SleepPromise(0);
	}
}

export class PreBuildContextImpl implements PreBuildContext<any> {
	private objective: Objective<any>;
	private director: Director;

	constructor(obj: Objective<any>, resolver: Director) {
		this.objective = obj;
		this.director = resolver;
	}

	get id() {
		return this.objective.progress.id;
	}
	toString() {
		return this.objective.progress.id;
	}
	get dependencies() {
		return this.objective.progress.dependencies;
	}
	get isVolatile() {
		return this.objective.progress.volatile;
	}
	get lastResult() {
		return this.objective.progress.lastResult;
	}

	async dependencyModified() {
		const depIDs = [...this.objective.progress.dependencies];
		for (const group of depIDs) {
			const deps = [...group];
			let triggered = [];
			try {
				triggered = await Promise.all(
					deps.map(dep => {
						const g = this.director.queryGoalFromString(false, dep);
						if (!g) throw this.director.ruleNotFound(dep);
						return this.director.checkTriggerRebuildByDependency(g, this.objective);
					})
				);
			} catch (e) {
				console.log(e);
				return true;
			}
			for (let j = 0; j < deps.length; j++) {
				if (!triggered[j]) continue;
				this.director.reporter.debug(
					"Triggered Update:",
					this.objective.goal.id,
					"<==",
					deps[j]
				);
				return true;
			}
		}
		return false;
	}

	async cutoffEarly() {
		if (this.director.reporter) {
			this.director.reporter.debug("Started early cutoff execute:", this.objective.goal.id);
		}
		await this.director.materialBuildNewTarget(this.objective);
		return this.objective.progress.preBuildResult === PreBuildResult.YES;
	}
}

const runningDependencies: WeakMap<
	Director,
	WeakMap<Objective<any>, Set<Objective<any>>>
> = new WeakMap();
function getRD<T, G extends object, R extends object>(
	rdMap: WeakMap<R, WeakMap<G, T>>,
	ctor: new () => T,
	target: G,
	resolver: R
): T {
	if (rdMap.has(resolver) && rdMap.get(resolver)!.has(target)) {
		return rdMap.get(resolver)!.get(target)!;
	} else {
		const proxy = new ctor();
		if (!rdMap.has(resolver)) rdMap.set(resolver, new WeakMap<G, T>());
		rdMap.get(resolver)!.set(target, proxy);
		return proxy;
	}
}

function resolveObjective(
	dir: Director,
	rootObjective: null | Objective<any>,
	t: PrimOrderGoalType
) {
	if (t === null || t === undefined) {
		return t;
	} else if (typeof t === "string") {
		const g = dir.queryGoalFromString(true, t);
		if (!g) {
			if (rootObjective) throw dir.dependencyNotFound(t, rootObjective.goal.id);
			else throw dir.ruleNotFound(t);
		}
		return g;
	} else {
		const g = dir.validateGoal(t);
		if (!g) {
			if (rootObjective) throw dir.dependencyNotFound(t.id, rootObjective.goal.id);
			else throw dir.ruleNotFound(t.id);
		}
		return g;
	}
}

function getObjectivesOfDepArgs(
	dir: Director,
	rootObjective: null | Objective<any>,
	args: OrderGoalTypeList,
	out: Set<Objective<any>>
) {
	for (const arg of args) {
		if (Array.isArray(arg)) {
			getObjectivesOfDepArgs(dir, rootObjective, arg, out);
		} else {
			const p = resolveObjective(dir, rootObjective, arg);
			if (p) out.add(p);
		}
	}
}

function getResultsOfDepArgs(
	dir: Director,
	rootObjective: null | Objective<any>,
	args: OrderGoalTypeList
): any[] {
	const ans: any[] = [];
	for (const arg of args) {
		if (Array.isArray(arg)) {
			ans.push(getResultsOfDepArgs(dir, rootObjective, arg));
		} else {
			const p = resolveObjective(dir, rootObjective, arg);
			if (p) ans.push(p.progress.result);
			else ans.push(p);
		}
	}
	return ans;
}

class ProgressIsImpl {
	constructor(
		private progress: ProgressImpl<any>,
		private flag: boolean,
		private director: Director
	) {}
	get not() {
		return new ProgressIsImpl(this.progress, !this.flag, this.director);
	}
	volatile() {
		this.progress.volatile = this.flag;
	}
	modified() {
		this.progress.preBuildStatus = PreBuildStatus.DECIDED;
		this.progress.preBuildResult = this.flag ? PreBuildResult.YES : PreBuildResult.NO;
		if (this.flag) {
			this.progress.revision = this.director.buildRev;
		}
	}
}

class BuildContextImpl implements ExtBuildContext<any> {
	private objective: Objective<any>;
	private director: Director;
	is: ProgressIsImpl;

	constructor(objective: Objective<any>, director: Director) {
		this.objective = objective;
		this.director = director;
		this.is = new ProgressIsImpl(objective.progress, true, director);
	}

	// Clear the runningDependencies for new session
	static clear(resolver: Director) {
		runningDependencies.set(resolver, new WeakMap());
	}

	// EDSL directives
	get id() {
		return this.objective.progress.id;
	}
	get lastResult() {
		return this.objective.progress.lastResult;
	}
	get revision() {
		return this.objective.progress.revision;
	}
	set revision(x: number) {
		this.objective.progress.revision = x;
	}
	get buildRevision() {
		return this.director.buildRev;
	}

	private getFlattenProgresses(args: OrderGoalTypeList, out: Set<Objective<any>>) {
		return getObjectivesOfDepArgs(this.director, this.objective, args, out);
	}

	private collectAllDeps(t: Objective<any>, s: Set<Objective<any>>) {
		if (s.has(t)) return;
		s.add(t);
		const rd = getRD<Set<Objective<any>>, Objective<any>, Director>(
			runningDependencies,
			Set,
			this.objective,
			this.director
		);
		for (const target of rd) {
			this.collectAllDeps(target, s);
		}
	}

	private checkCircular(deps: Iterable<Objective<any>>) {
		let allDeps = new Set();
		for (const t of deps) {
			this.collectAllDeps(t, allDeps);
			if (allDeps.has(this)) {
				throw new Error(
					`Circular dependency when building ${this.objective.goal.id}, depending on ${
						t.goal.id
					}.`
				);
			}
		}
	}

	private async _ordered(deps: Set<Objective<any>>): Promise<void> {
		const rd = getRD<Set<Objective<any>>, Objective<any>, Director>(
			runningDependencies,
			Set,
			this.objective,
			this.director
		);
		for (const d of deps) rd.add(d);
		this.checkCircular(deps);
		const dependencyPromises = [...deps].map(t => this.director.buildTarget(t));
		await this.objective.progress.halt(this.director);
		await Promise.all(dependencyPromises);
		await this.objective.progress.unhalt(this.director);
	}

	async order(...args: OrderGoalTypeList): Promise<any> {
		let deps: Set<Objective<any>> = new Set();
		this.getFlattenProgresses(args, deps);
		await this._ordered(deps);
		return getResultsOfDepArgs(this.director, this.objective, args);
	}

	private _needed(deps: Set<Objective<any>>) {
		if (deps.size) {
			this.objective.progress.dependencies.push(new Set([...deps].map(d => d.goal.id)));
		}
	}

	needed(...args: OrderGoalTypeList) {
		let deps: Set<Objective<any>> = new Set();
		this.getFlattenProgresses(args, deps);
		this._needed(deps);
	}

	async need(...args: OrderGoalTypeList): Promise<any> {
		let deps: Set<Objective<any>> = new Set();
		this.getFlattenProgresses(args, deps);
		await this._ordered(deps);
		this._needed(deps);
		return getResultsOfDepArgs(this.director, this.objective, args);
	}
}

import { Reporter } from "../reporter";
import { QuietReporter } from "../reporter/quiet";
import { BuildStatus, IResolver } from "./interfaces";
import { ETargetProxy, MCTargetProxy, RuleCandidate } from "./proxies";
import { Rule } from "./rule";
import Target from "./target";

export default class BuildResolver implements IResolver<Target> {
	private database: Map<string, Target> = new Map();
	private rules: Rule[] = [];

	reporter: Reporter = new QuietReporter();
	query(s: string): Target {
		const existing = this.database.get(s);
		if (existing) return existing;
		const target = new Target(s);
		this.database.set(s, target);
		return target;
	}

	defineRule(rule: Rule) {
		this.rules.unshift(rule);
	}

	private collectAllDeps(t: Target, s: Set<Target>) {
		if (s.has(t)) return;
		s.add(t);
		for (const group of t.dependencies) {
			for (const target of group) {
				this.collectAllDeps(target, s);
			}
		}
	}

	tryGetRule(t: Target, matchKind: boolean = false): RuleCandidate | null {
		for (const rule of this.rules) {
			const m = rule.match(t.id);
			if (m && (!matchKind || !t.builtKind || rule.kind === t.builtKind)) {
				return { rule, m };
			}
		}
		return null;
	}

	getRule(t: Target, matchKind: boolean = false): RuleCandidate {
		const r = this.tryGetRule(t, matchKind);
		if (!r) throw new Error("Rule not found for " + t.id);
		else return r;
	}

	checkModified(target: Target, against: Target) {
		const ruleCandidate = this.getRule(target);
		return this._checkModified(target, against, ruleCandidate);
	}

	private async _checkModified(
		target: Target,
		against: Target | null,
		ruleCandidate: RuleCandidate
	): Promise<boolean> {
		const proxy = new MCTargetProxy(target, this, ruleCandidate);
		const itselfModified = await target.startModifiedCheck(() => {
			return ruleCandidate.rule.checkModified(
				proxy,
				...(ruleCandidate ? ruleCandidate.m : [])
			);
		});
		if (against) {
			return ruleCandidate.rule.shouldTriggerModify(itselfModified, proxy, against);
		} else {
			return itselfModified;
		}
	}

	private async buildNewTarget(target: Target) {
		const ruleCandidate = this.getRule(target);
		if (!ruleCandidate) throw new Error(`Rule not found for ${target}.`);

		if (!(await this._checkModified(target, null, ruleCandidate))) {
			this.reporter.targetSkip(target.id, ruleCandidate.rule.kind);
			target.status = BuildStatus.FINISHED;
			return target.lastReturned;
		} else {
			const proxy = new ETargetProxy(target, this);
			this.reporter.targetStart(target.id, ruleCandidate.rule.kind);
			let r = undefined;
			try {
				r = await target.start(ruleCandidate.rule.kind, async () =>
					ruleCandidate.rule.exec(proxy, ...ruleCandidate.m)
				);
			} catch (e) {
				this.reporter.targetError(target.id, e);
				throw e;
			}
			this.reporter.targetEnd(target.id);
			return r;
		}
	}

	buildTarget(target: Target): Promise<any> {
		if (target.status !== BuildStatus.NOT_STARTED) {
			return target.finishPromise();
		} else {
			return this.buildNewTarget(target);
		}
	}

	want(target: Target): Promise<any> {
		ETargetProxy.clear(this);
		for (const target of this.database.values()) target.resetBuildStatus();
		return this.buildTarget(target);
	}

	fromJson(json: any) {
		for (const id in json) {
			this.query(id).fromJson(json[id], this);
		}
	}

	toJson(): any {
		const o: any = {};
		for (const [id, target] of this.database) {
			o[id] = target.toJson();
		}
		return o;
	}

	// Self tracking -- implicit dependency management
	setImplicitDependency(kind: string, rule: Target) {
		const depsOfSelfTracking = new Set();
		this.collectAllDeps(rule, depsOfSelfTracking);
		for (const t of this.database.values()) {
			let d1: Set<Target> = new Set();
			for (const d of t.implicitDependencies) {
				if (d !== rule) d1.add(d);
			}
			if (t.builtKind === kind && !depsOfSelfTracking.has(t)) {
				d1.add(rule);
			}
			t.implicitDependencies = d1;
		}
	}
}

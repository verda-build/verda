import { ITargetCheckModification, ITargetInfo, ITargetExec } from "../../engine/interfaces";
import { MatchFunction, Rule } from "../../engine/rule";
import { UserRule } from "./rule-base";

// Special rule type for self-tracking
export class SelfTracking extends UserRule implements Rule {
	constructor(kind: string, pattern: string | MatchFunction) {
		super(kind, pattern);
	}
	async exec(target: ITargetExec, ...m: string[]) {
		const r = await super.exec(target, ...m);
		target.is.updatedAt(new Date());
		return r;
	}
	async checkModified(target: ITargetCheckModification, ...m: string[]) {
		const u = target.volatile || (await target.dependencyModified());
		if (u) await target.cutoffEarly();
		return u;
	}
	async shouldTriggerModify(
		itselfModified: boolean,
		thisTarget: ITargetInfo,
		thatTarget: ITargetInfo
	) {
		return itselfModified || thisTarget.updated > thatTarget.updated;
	}
}

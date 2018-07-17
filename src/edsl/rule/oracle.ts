import { ITargetCheckModification, ITargetExec } from "../../engine/interfaces";
import { MatchFunction, Rule } from "../../engine/rule";
import { UserRule } from "./rule-base";

export class Oracle extends UserRule implements Rule {
	constructor(kind: string, pattern: string | MatchFunction) {
		super(kind, pattern);
	}
	async exec(target: ITargetExec, ...m: string[]) {
		const ret = await super.exec(target, ...m);
		target.trackModification(ret);
		return ret;
	}
	async checkModified(target: ITargetCheckModification, ...m: string[]) {
		if (target.volatile) return true;
		await target.dependencyModified();
		return await target.cutoffEarly();
	}
	async shouldTriggerModify(itselfModified: boolean) {
		return itselfModified;
	}
}

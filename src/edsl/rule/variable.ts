import { ITargetCheckModification, ITargetExec } from "../../engine/interfaces";
import { MatchFunction, Rule } from "../../engine/rule";
import { UserRule } from "./rule-base";

export class Variable extends UserRule implements Rule {
	constructor(kind: string, pattern: string | MatchFunction) {
		super(kind, pattern);
	}
	async exec(target: ITargetExec, ...m: string[]) {
		const ret = await super.exec(target, ...m);
		target.trackModification(ret);
		return ret;
	}
	async checkModified(target: ITargetCheckModification, ...m: string[]) {
		return (
			target.volatile || (await target.dependencyModified()) || (await target.cutoffEarly())
		);
	}
	async shouldTriggerModify(itselfModified: boolean) {
		return itselfModified;
	}
}

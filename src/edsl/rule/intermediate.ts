import { ITargetCheckModification } from "../../engine/interfaces";
import { MatchFunction, Rule } from "../../engine/rule";
import { UserRule } from "./rule-base";

export class Intermediate extends UserRule implements Rule {
	constructor(kind: string, pattern: string | MatchFunction) {
		super(kind, pattern);
	}
	async checkModified(target: ITargetCheckModification) {
		return target.volatile || (await target.dependencyModified());
	}
	async shouldTriggerModify(itselfModified: boolean) {
		return itselfModified;
	}
}

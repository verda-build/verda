import { ITargetCheckModification } from "../../engine/interfaces";
import { MatchFunction, Rule } from "../../engine/rule";
import { UserRule } from "./rule-base";

export class Task extends UserRule implements Rule {
	constructor(kind: string, pattern: string | MatchFunction) {
		super(kind, pattern);
	}
	async checkModified(target: ITargetCheckModification, ...m: string[]) {
		return (
			target.volatile ||
			target.dependencies.length === 0 ||
			(await target.dependencyModified())
		);
	}
	async shouldTriggerModify(itselfModified: boolean) {
		return itselfModified;
	}
}

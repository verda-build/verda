import { RuleBase, UserRule } from "./rule-base";
import { MatchFunction, Rule } from "../../engine/rule";
import { ITargetExec, ITargetCheckModification, ITargetInfo } from "../../engine/interfaces";
import * as fs from "fs-extra";
import { pathParseAndUpdate, fileIsUpdated } from "./utils";

export class File extends UserRule implements Rule {
	constructor(kind: string, pattern: string | MatchFunction) {
		super(kind, pattern);
	}
	async exec(target: ITargetExec, ...m: string[]) {
		await super.exec(target, ...m);
		const u = await pathParseAndUpdate(target.id);
		target.is.updatedAt(new Date(u.updated));
		return target.trackModification(u, fileIsUpdated);
	}
	async checkModified(target: ITargetCheckModification, ...m: string[]) {
		return (
			target.volatile ||
			!(await fs.pathExists(target.id)) ||
			(await target.dependencyModified())
		);
	}
	async shouldTriggerModify(
		itselfModified: boolean,
		thisTarget: ITargetInfo,
		thatTarget: ITargetInfo
	) {
		return itselfModified || thisTarget.updated > thatTarget.updated;
	}
}

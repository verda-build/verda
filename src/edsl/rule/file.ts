import * as fs from "fs-extra";
import { ITargetCheckModification, ITargetExec, ITargetInfo } from "../../engine/interfaces";
import { MatchFunction, Rule } from "../../engine/rule";
import { UserRule } from "./rule-base";
import { pathParseAndUpdate } from "./utils";

export class File extends UserRule implements Rule {
	constructor(kind: string, pattern: string | MatchFunction) {
		super(kind, pattern);
	}
	async exec(target: ITargetExec, ...m: string[]) {
		await super.exec(target, ...m);
		return await pathParseAndUpdate(target.id);
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

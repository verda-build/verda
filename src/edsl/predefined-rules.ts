import * as fs from "fs-extra";
import { ITargetCheckModification, ITargetExec, ITargetInfo } from "../engine/interfaces";
import { MatchFunction, Rule } from "../engine/rule";
import { PatternMatch } from "../match";
import { RuleBase } from "./rule/rule-base";
import { fileIsUpdated, pathParseAndUpdate, checkUpdateRecursiveDir } from "./rule/utils";
import { Variable } from "./rule/variable";

export const dirContent = new Variable("dir-content", "dir-content:***").def((target, $1) =>
	checkUpdateRecursiveDir(false, target, $1, "dir-content")
);
export const dirStructure = new Variable("dir-structure", "dir-structure:***").def((target, $1) =>
	checkUpdateRecursiveDir(true, target, $1, "dir-structure")
);

export class FileUpdated extends RuleBase implements Rule {
	constructor(kind: string, pattern: string | MatchFunction) {
		super(kind, pattern);
	}
	async exec(target: ITargetExec, $1: string) {
		if (await fs.pathExists($1)) {
			const u = await pathParseAndUpdate($1);
			target.is.updatedAt(new Date(u.updated));
			return target.trackModification(u, fileIsUpdated);
		} else {
			throw new Error("Dependent file not found: " + $1);
		}
	}
	async checkModified(target: ITargetCheckModification, $1) {
		return target.volatile || !(await fs.pathExists($1)) || (await target.cutoffEarly());
	}
	async shouldTriggerModify(
		itselfModified: boolean,
		thisTarget: ITargetCheckModification,
		thatTarget: ITargetInfo
	) {
		return itselfModified || thisTarget.updated > thatTarget.updated;
	}
}

export const fileUpdated = new FileUpdated(
	"file-updated",
	s => (/^[a-zA-z0-9\+\.\-]{2,}?:/.test(s) ? null : [s])
);
export const fileUpdatedExplicit = new FileUpdated(
	"file-updated",
	PatternMatch("file-updated:***")
);

export class FileExists extends RuleBase implements Rule {
	constructor(kind: string, pattern: string | MatchFunction) {
		super(kind, pattern);
	}
	async exec(target: ITargetExec, $1: string) {
		if (await fs.pathExists($1)) {
			return pathParseAndUpdate($1);
		} else {
			throw new Error("Dependent file not found: " + $1);
		}
	}
	async checkModified(target: ITargetCheckModification, $1) {
		return !(await fs.pathExists($1));
	}
	async shouldTriggerModify(itselfModified: boolean) {
		return itselfModified;
	}
}

export class DirExists extends RuleBase implements Rule {
	constructor(kind: string, pattern: string | MatchFunction) {
		super(kind, pattern);
	}
	async exec(target: ITargetExec, $1: string) {
		if (!(await fs.pathExists($1))) await fs.ensureDir($1);
		return pathParseAndUpdate($1);
	}
	async checkModified(target: ITargetCheckModification, $1) {
		return !(await fs.pathExists($1));
	}
	async shouldTriggerModify(itselfModified: boolean) {
		return itselfModified;
	}
}

export const fileExists = new FileExists("file-exists", PatternMatch("file-exists:***"));
export const dirExists = new DirExists("dir-exists", PatternMatch("dir:***"));

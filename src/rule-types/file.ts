import * as fs from "fs-extra";
import * as path from "path";

import { VerdaConfig } from "../config";
import Director from "../core/director";
import {
	BuildContext,
	ExportBuildRecipe,
	ExtBuildContext,
	GoalFunction,
	MatchFunction,
	PreBuildContext,
	PreBuildResult,
	Rule
} from "../core/interface";
import { hashFile, hashSmallFile } from "../file-hasher/host";
import { NonPosixifyPatternMatch } from "../match";
import { DirContents, ParsedPath } from "../match/interface";
import ParsedPathImpl from "../match/parse-path";
import posixifyPath from "../match/posixify-path";

import { FileStatInfo } from "./interface";
import { OracleRule } from "./oracle";
import { RuleBase } from "./rule-base";
import { GoalBuilder, SinglePlural_F } from "./util";

type Args = [ParsedPath];

class FileStatInfoImpl extends ParsedPathImpl implements FileStatInfo {
	readonly present: boolean = false;
	readonly updated: string = "?";
	readonly hash: string = "";
	constructor(s: string, updated?: Date, hash?: string) {
		super(s);
		if (updated && hash) {
			this.present = true;
			this.updated = updated.toISOString();
			this.hash = hash;
		}
	}
}

export async function pathParseAndUpdate(s: string) {
	if (!(await fs.pathExists(s))) {
		return new FileStatInfoImpl(s);
	} else {
		const stats = await fs.stat(s);
		const updated = stats.mtime;
		const hash = !stats.isFile()
			? "?"
			: stats.size < 0x100000
			? await hashSmallFile(s)
			: await hashFile(s);
		return new FileStatInfoImpl(s, updated, hash);
	}
}

async function getDirContents(
	recursive: boolean,
	target: BuildContext,
	$1: string,
	gfu: GoalFunction<FileStatInfo, Args>,
	gf: GoalFunction<DirContents, string[]>
) {
	target.is.volatile();
	if (!(await fs.pathExists($1))) {
		throw new Error("Dependent directory not found: " + $1);
	}

	await target.need(gfu`${$1}`);

	// Collect file and subdirectories
	const tracking: DirContents = {};
	let subDirKeys = [];
	let subDirTargets = [];

	const contents = (await fs.readdir($1)).sort();
	for (const file of contents) {
		if (/^\./.test(file)) continue; // Skip hidden files
		const subName = `${$1}/${file}`;
		const subStat = await fs.stat(subName);
		if (subStat.isDirectory()) {
			if (recursive) {
				subDirKeys.push(file + "/");
				subDirTargets.push(gf`${subName}`);
			}
		} else {
			tracking[file] = subName;
		}
	}

	// Collect trackings
	const values = await target.need(...subDirTargets);
	for (let j = 0; j < subDirKeys.length; j++) tracking[subDirKeys[j]] = values[j];
	return tracking;
}

function createMatcher(
	cfg: VerdaConfig,
	pattern: string | MatchFunction<string[]>
): MatchFunction<Args> {
	const pm = pattern instanceof Function ? pattern : NonPosixifyPatternMatch(pattern);
	return function(_path: string) {
		const rp = posixifyPath(path.relative(cfg.cwd, path.resolve(cfg.cwd, _path)));
		const frags = pm(rp);
		if (frags) {
			const pp = new ParsedPathImpl(rp, frags);
			return [pp];
		} else {
			return null;
		}
	};
}

function getRegularPath(cwd: string, p: string) {
	const rp = path.relative(cwd, path.resolve(cwd, p));
	return posixifyPath(rp);
}

class FileRule extends RuleBase<Args> implements Rule<FileStatInfo, Args> {
	readonly kindTag = "Builtin::FileRule";

	constructor(
		private readonly cfg: VerdaConfig,
		prefix: string,
		pattern: string | MatchFunction<string[]>,
		private FRecipe: ExportBuildRecipe<void, Args>
	) {
		super(prefix, createMatcher(cfg, pattern));
	}

	createGoalID(p: string) {
		return this.ruleIDPrefix + getRegularPath(this.cfg.cwd, p);
	}
	async build(t: ExtBuildContext<FileStatInfo>, path: ParsedPathImpl) {
		await this.FRecipe(t, path);
		t.is.modified();
		const u = await pathParseAndUpdate(path.full);
		return u;
	}
	async preBuild(t: PreBuildContext<FileStatInfo>, path: ParsedPathImpl) {
		if (t.isVolatile) return PreBuildResult.YES;
		if (await t.dependencyModified()) return PreBuildResult.YES;
		const u = await pathParseAndUpdate(path.full);
		return !u ||
			!u.present ||
			!t.lastResult ||
			!t.lastResult.present ||
			t.lastResult.hash !== u.hash
			? PreBuildResult.YES
			: PreBuildResult.TIME;
	}
}

export class FileUpdatedRule extends RuleBase<Args> implements Rule<FileStatInfo, Args> {
	readonly kindTag = "Builtin::FileUpdateRule";

	constructor(
		private readonly cfg: VerdaConfig,
		prefix: string,
		pattern: string | MatchFunction<string[]>
	) {
		super(prefix, createMatcher(cfg, pattern));
	}
	createGoalID(p: string) {
		return this.ruleIDPrefix + getRegularPath(this.cfg.cwd, p);
	}
	async build(target: ExtBuildContext<FileStatInfo>, $1: ParsedPathImpl) {
		const u = await pathParseAndUpdate($1.full);
		if (!u) {
			target.is.modified();
			return u;
		}
		if (
			!u.present ||
			!target.lastResult ||
			!target.lastResult.present ||
			target.lastResult.hash !== u.hash
		) {
			target.is.modified();
		} else {
			target.is.not.modified();
		}
		return u;
	}
	async preBuild(target: PreBuildContext<FileStatInfo>, $1: ParsedPathImpl) {
		const changed =
			target.isVolatile || !(await fs.pathExists($1.full)) || (await target.cutoffEarly());
		return changed ? PreBuildResult.YES : PreBuildResult.TIME;
	}
}
export class FileExistsRule extends RuleBase<Args> implements Rule<FileStatInfo, Args> {
	readonly kindTag = "Builtin::FileExistsRule";

	constructor(
		private readonly cfg: VerdaConfig,
		prefix: string,
		pattern: string | MatchFunction<string[]>
	) {
		super(prefix, createMatcher(cfg, pattern));
	}
	createGoalID(p: string) {
		return this.ruleIDPrefix + getRegularPath(this.cfg.cwd, p);
	}
	matchString(id: string) {
		return null;
	}
	async build(target: ExtBuildContext<FileStatInfo>, $1: ParsedPathImpl) {
		const u = await pathParseAndUpdate($1.full);
		if (!u || !u.present) throw new Error("Dependent file not found: " + $1.full);
		target.is.not.modified();
		return u;
	}
	async preBuild(target: PreBuildContext<FileStatInfo>, $1: ParsedPathImpl) {
		return target.isVolatile || !(await fs.pathExists($1.full))
			? PreBuildResult.YES
			: PreBuildResult.NO;
	}
}
export class DirExistsRule extends RuleBase<Args> implements Rule<FileStatInfo, Args> {
	readonly kindTag = "Builtin::DirExistsRule";

	constructor(
		private readonly cfg: VerdaConfig,
		prefix: string,
		pattern: string | MatchFunction<string[]>
	) {
		super(prefix, createMatcher(cfg, pattern));
	}
	createGoalID(p: string) {
		return this.ruleIDPrefix + getRegularPath(this.cfg.cwd, p);
	}
	matchString(id: string) {
		return null;
	}
	async build(target: ExtBuildContext<FileStatInfo>, $1: ParsedPathImpl) {
		if (!(await fs.pathExists($1.full))) await fs.ensureDir($1.full);
		const u = await pathParseAndUpdate($1.full);
		target.is.not.modified();
		return u;
	}
	async preBuild(target: PreBuildContext<FileStatInfo>, $1: ParsedPathImpl) {
		return target.isVolatile || !(await fs.pathExists($1.full))
			? PreBuildResult.YES
			: PreBuildResult.NO;
	}
}

export function File(cfg: VerdaConfig, dir: Director) {
	const _file = SinglePlural_F<void, FileStatInfo, string[], Args>(
		"Builtin::File::",
		dir,
		(s: string) => [s],
		(prefix, pattern, FRecipe) => new FileRule(cfg, prefix, pattern, FRecipe)
	);
	return { file: _file.exact, files: _file.patterned };
}

function FileUpdated(cfg: VerdaConfig) {
	const prefix = "Builtin::FileUpdated::";
	const rule = new FileUpdatedRule(cfg, prefix, s => [s]);
	return { gb: GoalBuilder<FileStatInfo, Args, string>(rule), rule };
}

function FileExists(cfg: VerdaConfig) {
	const prefix = "Builtin::FileExists::";
	const rule = new FileExistsRule(cfg, prefix, s => [s]);
	return { gb: GoalBuilder<FileStatInfo, Args, string>(rule), rule };
}

function DirExists(cfg: VerdaConfig) {
	const prefix = "Builtin::DirExists::";
	const rule = new DirExistsRule(cfg, prefix, s => [s]);
	return { gb: GoalBuilder<FileStatInfo, Args, string>(rule), rule };
}

function DirContent(cfg: VerdaConfig, gfu: GoalFunction<FileStatInfo, Args>) {
	const prefix = "Builtin::DirContent::";

	let gfDC: GoalFunction<DirContents, string[]>;
	const rule = new OracleRule(
		true,
		prefix,
		s => [s],
		(t, path) => getDirContents(false, t, getRegularPath(cfg.cwd, path), gfu, gfDC)
	);
	gfDC = GoalBuilder<DirContents, string[], string>(rule);

	return { gb: gfDC, rule };
}

function DirStructure(cfg: VerdaConfig, gfu: GoalFunction<FileStatInfo, Args>) {
	const prefix = "Builtin::DirStructure::";

	let gfDC: GoalFunction<DirContents, string[]>;
	const rule = new OracleRule(
		true,
		prefix,
		s => [s],
		(t, path) => getDirContents(true, t, getRegularPath(cfg.cwd, path), gfu, gfDC)
	);
	gfDC = GoalBuilder<DirContents, string[], string>(rule);

	return { gb: gfDC, rule };
}

export function ImplicitFileRules(cfg: VerdaConfig, dir: Director) {
	const fu = FileUpdated(cfg);
	const fe = FileExists(cfg);
	const de = DirExists(cfg);
	const dc = DirContent(cfg, fu.gb);
	const ds = DirStructure(cfg, fu.gb);

	fe.rule.ignoreStringMatch = true;
	fe.rule.isUser = false;
	dir.addRule(fe.rule);
	de.rule.ignoreStringMatch = true;
	de.rule.isUser = false;
	dir.addRule(de.rule);
	dc.rule.ignoreStringMatch = true;
	dc.rule.isUser = false;
	dir.addRule(dc.rule);
	ds.rule.ignoreStringMatch = true;
	ds.rule.isUser = false;
	dir.addRule(ds.rule);
	fu.rule.ignoreStringMatch = true;
	fu.rule.isUser = false;
	dir.addRule(fu.rule);

	return {
		F: fu.gb,
		D: de.gb,
		fu: fu.gb,
		fileUpdated: fu.gb,
		fe: fe.gb,
		fileExists: fe.gb,
		de: de.gb,
		dirExists: de.gb,
		dc: dc.gb,
		dirContent: dc.gb,
		ds: ds.gb,
		dirStructure: ds.gb
	};
}

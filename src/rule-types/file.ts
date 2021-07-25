import * as fs from "fs-extra";
import * as path from "path";

import { VerdaConfig } from "../config";
import Director from "../core/director";
import {
	BuildContext,
	ExportBuildRecipe,
	ExtBuildContext,
	GoalFunction,
	GoalMatcher,
	PreBuildContext,
	PreBuildResult,
	Rule,
} from "../core/interface";
import { hashFile, hashSmallFile } from "../file-hasher/host";
import { DirContents } from "../match/interface";
import ParsedPathImpl from "../match/parse-path";
import posixifyPath from "../match/posixify-path";

import { FileStatInfo } from "./interface";
import {
	AlwaysMatcher,
	FileExecArgs,
	FilePathMatcherT,
	KindMatcherT,
	NoStringMatcherT,
} from "./matchers";
import { OracleRule } from "./oracle";
import { RuleBase } from "./rule-base";
import { GoalBuilder, SinglePlural_F } from "./util";

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
	notChanged(that: null | undefined | FileStatInfo) {
		if (!that) return false;
		if (!this.present) return false;
		if (!that.present) return false;
		if (this.hash === "?" || that.hash === "?") return false;
		return this.hash === that.hash;
	}
	optionalFileNotChanged(that: null | undefined | FileStatInfo) {
		if (!that) return false;
		if (this.present !== that.present) return false;
		if (this.hash === "?" || that.hash === "?") return false;
		return this.hash === that.hash;
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
	gfu: GoalFunction<FileStatInfo, FileExecArgs>,
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

function getRegularPath(cwd: string, p: string) {
	const rp = path.relative(cwd, path.resolve(cwd, p));
	return posixifyPath(rp);
}

class FileRule extends RuleBase<FileExecArgs> implements Rule<FileStatInfo, FileExecArgs> {
	readonly kindTag = "Builtin::FileRule";

	constructor(
		matcher: GoalMatcher<FileExecArgs>,
		private FRecipe: ExportBuildRecipe<void, FileExecArgs>
	) {
		super(matcher);
	}

	async build(t: ExtBuildContext<FileStatInfo>, path: ParsedPathImpl, ...args: string[]) {
		await this.FRecipe(t, path, ...args);
		t.is.modified();
		const u = await pathParseAndUpdate(path.full);
		return u;
	}
	async preBuild(t: PreBuildContext<FileStatInfo>, path: ParsedPathImpl) {
		if (t.isVolatile) return PreBuildResult.YES;
		if (await t.dependencyModified()) return PreBuildResult.YES;
		const u = await pathParseAndUpdate(path.full);
		return !u || !u.notChanged(t.lastResult) ? PreBuildResult.YES : PreBuildResult.TIME;
	}
}

export class FileUpdatedRule
	extends RuleBase<FileExecArgs>
	implements Rule<FileStatInfo, FileExecArgs>
{
	readonly kindTag = "Builtin::FileUpdateRule";

	constructor(matcher: GoalMatcher<FileExecArgs>) {
		super(matcher);
	}

	async build(target: ExtBuildContext<FileStatInfo>, $1: ParsedPathImpl) {
		const u = await pathParseAndUpdate($1.full);
		if (!u.notChanged(target.lastResult)) {
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

export class OptionalFileUpdatedRule
	extends RuleBase<FileExecArgs>
	implements Rule<FileStatInfo, FileExecArgs>
{
	readonly kindTag = "Builtin::OptionalFileUpdateRule";

	constructor(matcher: GoalMatcher<FileExecArgs>) {
		super(matcher);
	}

	async build(target: ExtBuildContext<FileStatInfo>, $1: ParsedPathImpl) {
		const u = await pathParseAndUpdate($1.full);
		if (!u.optionalFileNotChanged(target.lastResult)) {
			target.is.modified();
		} else {
			target.is.not.modified();
		}
		return u;
	}
	async preBuild(target: PreBuildContext<FileStatInfo>, $1: ParsedPathImpl) {
		const changed = target.isVolatile || (await target.cutoffEarly());
		return changed ? PreBuildResult.YES : PreBuildResult.TIME;
	}
}

export class SourceFileUpdatedRule
	extends RuleBase<FileExecArgs>
	implements Rule<FileStatInfo, FileExecArgs>
{
	readonly kindTag = "Builtin::SourceFileUpdatedRule";

	constructor(matcher: GoalMatcher<FileExecArgs>) {
		super(matcher);
	}

	async build(target: ExtBuildContext<FileStatInfo>, $1: ParsedPathImpl) {
		const u = await pathParseAndUpdate($1.full);
		if (!u.present) {
			throw new Error(`File ${$1.full} is required but missing.`);
		}
		if (!u.notChanged(target.lastResult)) {
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

export class FileExistsRule
	extends RuleBase<FileExecArgs>
	implements Rule<FileStatInfo, FileExecArgs>
{
	readonly kindTag = "Builtin::FileExistsRule";

	constructor(matcher: GoalMatcher<FileExecArgs>) {
		super(matcher);
	}

	matchString(id: string) {
		return null;
	}
	async build(target: ExtBuildContext<FileStatInfo>, $1: ParsedPathImpl) {
		const u = await pathParseAndUpdate($1.full);
		if (!u.present) throw new Error("Dependent file not found: " + $1.full);
		target.is.not.modified();
		return u;
	}
	async preBuild(target: PreBuildContext<FileStatInfo>, $1: ParsedPathImpl) {
		return target.isVolatile || !(await fs.pathExists($1.full))
			? PreBuildResult.YES
			: PreBuildResult.NO;
	}
}
export class DirExistsRule
	extends RuleBase<FileExecArgs>
	implements Rule<FileStatInfo, FileExecArgs>
{
	readonly kindTag = "Builtin::DirExistsRule";

	constructor(matcher: GoalMatcher<FileExecArgs>) {
		super(matcher);
	}

	matchString(id: string) {
		return null;
	}
	async build(target: ExtBuildContext<FileStatInfo>, $1: ParsedPathImpl) {
		if (!(await fs.pathExists($1.full))) {
			await fs.ensureDir($1.full);
			target.is.modified();
		} else {
			target.is.not.modified();
		}
		const u = await pathParseAndUpdate($1.full);
		return u;
	}
	async preBuild(target: PreBuildContext<FileStatInfo>, $1: ParsedPathImpl) {
		return target.isVolatile || !(await fs.pathExists($1.full))
			? PreBuildResult.YES
			: PreBuildResult.NO;
	}
}

export function File(cfg: VerdaConfig, dir: Director) {
	const _file = SinglePlural_F<void, FileStatInfo>(
		"Builtin::File::",
		dir,
		cfg,
		(matcher, FRecipe) => new FileRule(matcher, FRecipe)
	);
	return { file: Object.assign(_file.exact, { glob: _file.glob, make: _file.make }) };
}

function FileUpdated(cfg: VerdaConfig) {
	const prefix = "Builtin::FileUpdated::";
	const matcher = new NoStringMatcherT(
		new KindMatcherT(prefix, new FilePathMatcherT(cfg, new AlwaysMatcher()))
	);
	const rule = new FileUpdatedRule(matcher);
	return { gb: GoalBuilder<FileStatInfo, FileExecArgs, string>(matcher, rule), rule };
}
function OptionalFileUpdated(cfg: VerdaConfig) {
	const prefix = "Builtin::OptionalFileUpdated::";
	const matcher = new NoStringMatcherT(
		new KindMatcherT(prefix, new FilePathMatcherT(cfg, new AlwaysMatcher()))
	);
	const rule = new OptionalFileUpdatedRule(matcher);
	return { gb: GoalBuilder<FileStatInfo, FileExecArgs, string>(matcher, rule), rule };
}
function SourceFileUpdated(cfg: VerdaConfig) {
	const prefix = "Builtin::SourceFileUpdated::";
	const matcher = new NoStringMatcherT(
		new KindMatcherT(prefix, new FilePathMatcherT(cfg, new AlwaysMatcher()))
	);
	const rule = new SourceFileUpdatedRule(matcher);
	return { gb: GoalBuilder<FileStatInfo, FileExecArgs, string>(matcher, rule), rule };
}
function FileExists(cfg: VerdaConfig) {
	const prefix = "Builtin::FileExists::";
	const matcher = new NoStringMatcherT(
		new KindMatcherT(prefix, new FilePathMatcherT(cfg, new AlwaysMatcher()))
	);
	const rule = new FileExistsRule(matcher);
	return { gb: GoalBuilder<FileStatInfo, FileExecArgs, string>(matcher, rule), rule };
}
function DirExists(cfg: VerdaConfig) {
	const prefix = "Builtin::DirExists::";
	const matcher = new NoStringMatcherT(
		new KindMatcherT(prefix, new FilePathMatcherT(cfg, new AlwaysMatcher()))
	);
	const rule = new DirExistsRule(matcher);
	return { gb: GoalBuilder<FileStatInfo, FileExecArgs, string>(matcher, rule), rule };
}
function DirContent(cfg: VerdaConfig, gfu: GoalFunction<FileStatInfo, FileExecArgs>) {
	const prefix = "Builtin::DirContent::";

	let gfDC: GoalFunction<DirContents, string[]>;
	const matcher = new NoStringMatcherT(new KindMatcherT(prefix, new AlwaysMatcher()));
	const rule = new OracleRule(true, matcher, (t, path) =>
		getDirContents(false, t, getRegularPath(cfg.cwd, path), gfu, gfDC)
	);
	gfDC = GoalBuilder<DirContents, string[], string>(matcher, rule);

	return { gb: gfDC, rule };
}
function DirStructure(cfg: VerdaConfig, gfu: GoalFunction<FileStatInfo, FileExecArgs>) {
	const prefix = "Builtin::DirStructure::";

	let gfDC: GoalFunction<DirContents, string[]>;
	const matcher = new NoStringMatcherT(new KindMatcherT(prefix, new AlwaysMatcher()));
	const rule = new OracleRule(true, matcher, (t, path) =>
		getDirContents(true, t, getRegularPath(cfg.cwd, path), gfu, gfDC)
	);
	gfDC = GoalBuilder<DirContents, string[], string>(matcher, rule);

	return { gb: gfDC, rule };
}

export function ImplicitFileRules(cfg: VerdaConfig, dir: Director) {
	const fu = FileUpdated(cfg);
	const sfu = SourceFileUpdated(cfg);
	const ofu = OptionalFileUpdated(cfg);
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
	sfu.rule.ignoreStringMatch = true;
	sfu.rule.isUser = false;
	dir.addRule(sfu.rule);
	ofu.rule.ignoreStringMatch = true;
	ofu.rule.isUser = false;
	dir.addRule(ofu.rule);

	return {
		F: fu.gb,
		S: sfu.gb,
		D: de.gb,

		fu: fu.gb,
		fileUpdated: fu.gb,
		sfu: sfu.gb,
		sourceFileUpdated: sfu.gb,
		ofu: ofu.gb,
		optionalFileUpdated: ofu.gb,
		fe: fe.gb,
		fileExists: fe.gb,
		de: de.gb,
		dirExists: de.gb,
		dc: dc.gb,
		dirContent: dc.gb,
		ds: ds.gb,
		dirStructure: ds.gb,
	};
}

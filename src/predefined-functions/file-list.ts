import * as path from "path";

import { BuildContext, GoalFunction, MatchFunction } from "../core/interface";
import { PatternMatch } from "../match";
import { DirContents } from "../match/interface";
import posixifyPath from "../match/posixify-path";

export interface FileListDefinitionOptions {
	under: string;
	pattern?: MatchFunction<string[]> | string;
	transform?: (full: string, from: string, ...parts: string[]) => string;
}

function _collectFilesFromDirStructureResult(o: any, a: string[]) {
	for (const key in o) {
		if (typeof o[key] === "string") a.push(o[key].replace(/^(\.\/)+/g, ""));
		else _collectFilesFromDirStructureResult(o[key], a);
	}
}

function collectFilesFromDirStructureResult(o: any) {
	let a: string[] = [];
	_collectFilesFromDirStructureResult(o, a);
	return a;
}
// File list definition
function fileListExec(
	options: FileListDefinitionOptions,
	dsg: GoalFunction<DirContents, string[]>
) {
	const { under: dir, pattern, transform } = options;
	const mf: MatchFunction<string[]> =
		pattern instanceof Function ? pattern : pattern ? PatternMatch(pattern) : () => [];

	return async function(target: BuildContext) {
		const [fo] = await target.order(dsg`${dir}`);
		const files = collectFilesFromDirStructureResult(fo);
		const result = [];
		for (const _file of files) {
			const file = posixifyPath(path.relative(dir, _file));
			const m = mf(file);
			if (!m) continue;
			if (transform) result.push(transform(_file, file, ...m));
			else result.push(_file);
		}
		return result;
	};
}

export function BindFileList(dsg: GoalFunction<DirContents, string[]>) {
	return function FileList(options: FileListDefinitionOptions) {
		const fn = fileListExec(options, dsg);
		return async (target: BuildContext) => {
			return await fn(target);
		};
	};
}

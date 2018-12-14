import * as path from "path";
import { MatchFunction } from "../../engine/rule";
import { PatternMatch } from "../../match";
import {
	collectFilesFromDirStructureResult,
	FileStatInfo,
	pathParseAndUpdate
} from "../rule/utils";
import posixifyPath from "../../match/posixify-path";
import { ITargetExec } from "../../engine/interfaces";

export interface FileListDefinitionOptions {
	under: string;
	pattern?: MatchFunction | string;
	transform?: (full: string, from: string, ...parts: string[]) => string;
}

// File list definition
function fileListExec(options: FileListDefinitionOptions) {
	const { under: dir, pattern, transform } = options;
	const mf: MatchFunction =
		pattern instanceof Function ? pattern : pattern ? PatternMatch(pattern) : () => [];

	return async function(target: ITargetExec) {
		const [fo] = await target.order(`dir-structure:${dir}`);
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
export function FileList(options: FileListDefinitionOptions) {
	const fn = fileListExec(options);
	return async (target: ITargetExec) => {
		return target.trackModification(await fn(target));
	};
}
export function FileListUpdated(options: FileListDefinitionOptions) {
	const fn = fileListExec(options);
	return async (target: ITargetExec) => {
		const r = await fn(target);
		const ans = await Promise.all(r.map(pathParseAndUpdate));
		return target.trackModification(ans);
	};
}

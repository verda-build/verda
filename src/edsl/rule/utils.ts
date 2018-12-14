import * as fs from "fs-extra";
import { ITargetExec, ITargetPath } from "../../engine/interfaces";
import ParsedPath from "../../engine/parse-path";
import { Dict } from "../../actions/interfaces";

export class FileStatInfo extends ParsedPath implements ITargetPath {
	readonly present: boolean = false;
	readonly updated: string = "?";
	constructor(s: string, updated?: Date) {
		super(s);
		if (updated) {
			this.present = true;
			this.updated = updated.toISOString();
		}
	}
}

export async function pathParseAndUpdate(s: string) {
	if (!(await fs.pathExists(s))) {
		return new FileStatInfo(s);
	} else {
		const updated = (await fs.stat(s)).mtime;
		return new FileStatInfo(s, updated);
	}
}

export async function checkUpdateRecursiveDir(
	recursive: boolean,
	target: ITargetExec,
	$1: string,
	prefix: string
) {
	if (!(await fs.pathExists($1))) {
		throw new Error("Dependent directory not found: " + $1);
	}

	await target.need(`file-updated:${$1}`);

	// Collect file and subdirectories
	const tracking: Dict<string> = {};
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
				subDirTargets.push(`${prefix}:${subName}`);
			}
		} else {
			tracking[file] = subName;
		}
	}

	// Collect trackings
	const [values] = await target.need(subDirTargets);
	for (let j = 0; j < subDirKeys.length; j++) {
		tracking[subDirKeys[j]] = values[j];
	}
	return tracking;
}

function _collectFilesFromDirStructureResult(o: any, a: string[]) {
	for (const key in o) {
		if (typeof o[key] === "string") a.push(o[key].replace(/^(\.\/)+/g, ""));
		else _collectFilesFromDirStructureResult(o[key], a);
	}
}

export function collectFilesFromDirStructureResult(o: any) {
	let a: string[] = [];
	_collectFilesFromDirStructureResult(o, a);
	return a;
}

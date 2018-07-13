import * as path from "path";
import * as fs from "fs-extra";
import { ITargetExec } from "../../engine/interfaces";

export async function pathParseAndUpdate(s: string) {
	const pp = path.parse(s);
	const stat = (await fs.stat(s)).mtime;
	const updated = stat.toISOString();
	const r = {
		path: s,
		root: pp.root,
		dir: pp.dir,
		name: pp.name,
		ext: pp.ext,
		base: pp.base,
		updated
	};

	return r;
}

export function fileIsUpdated(last: { updated: string }, x: { updated: string }) {
	return last && last.updated === x.updated;
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
	const tracking = {};
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

function _collectFilesFromDirStructureResult(o: object, a: string[]) {
	for (const key in o) {
		if (typeof o[key] === "string") a.push(o[key].replace(/^(\.\/)+/g, ""));
		else _collectFilesFromDirStructureResult(o[key], a);
	}
}

export function collectFilesFromDirStructureResult(o: object) {
	let a: string[] = [];
	_collectFilesFromDirStructureResult(o, a);
	return a;
}

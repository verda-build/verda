import * as fs from "fs-extra";
import * as path from "path";
import { IExternalOptions } from "../config";

export async function searchConfig(
	args: IExternalOptions,
	fileNames: string[]
): Promise<{ cwd: string; rulePath: string }> {
	let { cwd, rulePath } = args;

	if (rulePath) {
		// TODO: refactor this when we move the target to ESM.
		rulePath = require.resolve(path.resolve(rulePath));
		if (!fs.pathExistsSync(rulePath)) {
			throw new Error(`Rule file ${rulePath} does not exist.`);
		}
		return {
			cwd: cwd || path.dirname(rulePath),
			rulePath,
		};
	} else {
		if (!cwd) cwd = process.cwd();
		cwd = path.resolve(cwd);
		do {
			for (const fn of fileNames) {
				if (fs.pathExistsSync(path.join(cwd, fn))) {
					return {
						cwd: cwd,
						rulePath: path.join(cwd, fn),
					};
				}
			}
			if (path.resolve(cwd, "..") === cwd) break;
			cwd = path.resolve(cwd, "..");
		} while (true);
	}

	throw new Error(`Rule file ${fileNames} does not exist.`);
}

import * as path from "path";
import * as fs from "fs-extra";
export function searchConfig(r: string, f: string, fn: string): { cwd: string; config: string } {
	if (f) {
		f = require.resolve(path.resolve(f));
		if (!fs.pathExistsSync(f)) throw new Error(`Rule file ${f} does not exist.`);
		return {
			cwd: r || path.dirname(f),
			config: f
		};
	}
	if (!r) r = process.cwd();
	r = path.resolve(r);
	do {
		if (fs.pathExistsSync(path.join(r, fn))) {
			return {
				cwd: r,
				config: path.join(r, fn)
			};
		}
		if (path.resolve(r, "..") === r) break;
		r = path.resolve(r, "..");
	} while (true);
	throw new Error(`Rule file ${fn} does not exist.`);
}

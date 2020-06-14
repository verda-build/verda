import * as fs from "fs-extra";
import * as path from "path";

export type SearchConfigArgv = {
	r?: null | undefined | string;
	f?: null | undefined | string;
};
export function searchConfig(argv: SearchConfigArgv, fn: string): { cwd: string; config: string } {
	let workDir = argv.r,
		explicitRuleFile = argv.f;
	if (explicitRuleFile) {
		explicitRuleFile = require.resolve(path.resolve(explicitRuleFile));
		if (!fs.pathExistsSync(explicitRuleFile)) {
			throw new Error(`Rule file ${explicitRuleFile} does not exist.`);
		}
		return {
			cwd: workDir || path.dirname(explicitRuleFile),
			config: explicitRuleFile,
		};
	}
	if (!workDir) workDir = process.cwd();
	workDir = path.resolve(workDir);
	do {
		if (fs.pathExistsSync(path.join(workDir, fn))) {
			return {
				cwd: workDir,
				config: path.join(workDir, fn),
			};
		}
		if (path.resolve(workDir, "..") === workDir) break;
		workDir = path.resolve(workDir, "..");
	} while (true);
	throw new Error(`Rule file ${fn} does not exist.`);
}

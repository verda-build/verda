import * as fs from "fs-extra";
import * as path from "path";

import { ActionEnv } from "./interfaces";

export function createKit_File(ce: ActionEnv) {
	return {
		cp: (from: string, to: string) =>
			fs.copy(path.resolve(ce.cd, from + ""), path.resolve(ce.cd, to + "")),
		mv: (from: string, to: string) =>
			fs.move(path.resolve(ce.cd, from + ""), path.resolve(ce.cd, to + "")),
		rm: (file: string) => fs.remove(path.resolve(ce.cd, file + "")),
		exists: (file: string) => fs.pathExists(path.resolve(ce.cd, file + "")),
		touch: (file: string) => fs.ensureFile(path.resolve(ce.cd, file + "")),
		mkdir: (d: string) => fs.ensureDir(path.resolve(ce.cd, d + "")),
		chmod: (file: string, mode: string | number) =>
			fs.chmod(path.resolve(ce.cd, file + ""), mode)
	};
}

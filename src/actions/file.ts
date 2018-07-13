import { ActionEnv } from "./interfaces";
import * as fs from "fs-extra";
import * as path from "path";

export function createKit_File(ce: ActionEnv) {
	return {
		cp: (from, to) => fs.copy(path.resolve(ce.cd, from + ""), path.resolve(ce.cd, to + "")),
		mv: (from, to) => fs.move(path.resolve(ce.cd, from + ""), path.resolve(ce.cd, to + "")),
		rm: file => fs.remove(path.resolve(ce.cd, file + "")),
		exists: file => fs.pathExists(path.resolve(ce.cd, file + "")),
		touch: file => fs.ensureFile(path.resolve(ce.cd, file + "")),
		mkdir: d => fs.ensureDir(path.resolve(ce.cd, d + "")),
		chmod: (file, mode: string | number) => fs.chmod(path.resolve(ce.cd, file + ""), mode)
	};
}

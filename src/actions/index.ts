import * as path from "path";

import { createKit_Command } from "./command";
import { createKit_Echo } from "./echo";
import { createKit_File } from "./file";
import { ActionEnv, Dict } from "./interfaces";
import { createKit_NodeJS } from "./nodejs/command";
import { createKit_Fail } from "./fail";

function defaultActions(ce: ActionEnv) {
	return {
		...createKit_Command(ce),
		...createKit_NodeJS(ce),
		...createKit_Echo(ce),
		...createKit_File(ce),
		...createKit_Fail(ce)
	};
}

// Default command bindings
export function defaultActionKit(ce: ActionEnv) {
	function cd(into: string) {
		return Object.assign({ ...ce }, { cd: path.resolve(ce.cd || "", into) });
	}
	function withEnv(e: Dict<string>) {
		return Object.assign({ ...ce }, { env: Object.assign({}, ce.env, e) });
	}
	return {
		...defaultActions(ce),
		cd: (into: string) => defaultActionKit(cd(into)),
		withEnv: (e: Dict<string>) => defaultActionKit(withEnv(e))
	};
}

import * as path from "path";
import { QuietReporter } from "../reporter/quiet";
import { SuppressedReporter } from "../reporter/suppressed";
import { createKit_Command } from "./command";
import { createKit_Echo } from "./echo";
import { createKit_Fail } from "./fail";
import { createKit_File } from "./file";
import { ActionEnv, Dict } from "./interfaces";
import { createKit_NodeJS } from "./nodejs/command";

function defaultActions(ce: ActionEnv) {
	return {
		...createKit_Command(ce),
		...createKit_NodeJS(ce),
		...createKit_Echo(ce),
		...createKit_File(ce),
		...createKit_Fail(ce),
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
		silently: defaultActions({ ...ce, reporter: new SuppressedReporter(ce.reporter) }),
		absolutelySilently: defaultActions({ ...ce, reporter: new QuietReporter() }),
		cd: (into: string) => defaultActionKit(cd(into)),
		withEnv: (e: Dict<string>) => defaultActionKit(withEnv(e)),
	};
}

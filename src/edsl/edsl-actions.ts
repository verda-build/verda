import * as path from "path";
import { createKit_Command } from "../actions/command";
import { ActionEnv, Dict } from "../actions/interfaces";
import { createKit_NodeJS } from "../actions/nodejs/command";
import { Bddy2Config } from "./config";
import { createKit_Echo } from "../actions/echo";
import { createKit_File } from "../actions/file";

export type ActionKit = { [key: string]: Function };
export type ActionKitFunction = (ce: ActionEnv, config: Bddy2Config) => ActionKit;
export type ActionEnvKit = { [key: string]: (argument: any) => ActionEnv };
export type ActionEnvKitFunction = (ce: ActionEnv, config: Bddy2Config) => ActionEnvKit;

// Default command bindings
export function defaultActionKit(ce: ActionEnv, config: Bddy2Config) {
	return {
		...createKit_Command(ce, config.toCreateResource("jCmd")),
		...createKit_NodeJS(ce, config.toCreateResource("jCmd")),
		...createKit_Echo(ce),
		...createKit_File(ce)
	};
}

// Environment transformation binding
export function defaultActionEnvKit(ce: ActionEnv, config: Bddy2Config) {
	function cd(into: string) {
		return Object.assign(Object.create(ce), { cd: path.resolve(ce.cd || "", into) });
	}
	function withEnv(e: Dict<string>) {
		return Object.assign(Object.create(ce), { env: Object.assign({}, ce.env, e) });
	}
	return { cd, withEnv };
}

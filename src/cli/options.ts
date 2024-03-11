import { parse } from "ts-command-line-args";
import { IExternalOptions } from "../config";

export interface CliOptions extends IExternalOptions {
	targets: string[];
}

export const args = parse<CliOptions>({
	cwd: { optional: true, type: String, alias: "r" },
	rulePath: { optional: true, type: String, alias: "f" },
	jCmd: { optional: true, type: Number },
	verbosity: { optional: true, type: Number },

	targets: { defaultOption: true, multiple: true, type: String },
});

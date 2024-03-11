import { parse } from "ts-command-line-args";
import { IExternalOptions } from "../config";

export interface CliOptions extends IExternalOptions {
	targets: string[];
	help?: boolean;
}

export const args = parse<CliOptions>(
	{
		cwd: {
			optional: true,
			type: String,
			alias: "r",
			description: "Path of the working directory",
		},
		rulePath: {
			optional: true,
			type: String,
			alias: "f",
			description: "Path to the rules file",
		},
		jCmd: { optional: true, type: Number, description: "Limit of parallel threads" },
		verbosity: { optional: true, type: Number, description: "Verbosity level" },

		targets: {
			defaultOption: true,
			multiple: true,
			type: String,
			description: "The list of targets to build",
		},
		help: { type: Boolean, optional: true, alias: "h", description: "Prints this usage guide" },
	},
	{
		helpArg: "help",
		stopAtFirstUnknown: true,
		headerContentSections: [{ header: "Usage", content: "verda [options] targets ..." }],
	}
);

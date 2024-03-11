import * as os from "os";
import * as path from "path";

import { ActionEnv, Dict } from "../actions/interfaces";
import { Reporter } from "../reporter";
import { ProxyReporter } from "../reporter/proxy";
import { QuietReporter } from "../reporter/quiet";

export interface IExternalOptions {
	rulePath?: null | undefined | string;
	cwd?: null | undefined | string;
	jCmd?: number;
	verbosity?: number;
}

export class VerdaConfig {
	rulePath: string = "";
	cwd: string = process.cwd();
	env: Dict<string | undefined> = process.env;
	param: Dict<string> = {};
	journal: string = "";
	objectives: string[] = [];
	jCmd: number = 0;
	verbosity: number = 6;
	reporter: Reporter = new QuietReporter();

	createActionEnv(): ActionEnv {
		return {
			cd: this.cwd,
			cwd: this.cwd,
			env: { ...this.env },
			rulePath: this.rulePath,
			reporter: new ProxyReporter(() => this.reporter),
		};
	}

	constructor(options: IExternalOptions) {
		this.bind(options);
	}
	bind(options: IExternalOptions) {
		if (options.rulePath) {
			this.rulePath = options.rulePath;
			this.cwd = path.dirname(this.rulePath);
		}
		if (options.cwd) {
			if (!this.journal) this.journal = path.join(options.cwd, ".verda-journal");
			this.cwd = options.cwd;
		}
		this.jCmd = options.jCmd || os.cpus().length;
		this.verbosity = options.verbosity && options.verbosity >= 0 ? options.verbosity : 6;
	}
}

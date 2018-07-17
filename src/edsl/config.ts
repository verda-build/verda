import * as os from "os";
import * as path from "path";
import { ActionEnv, Dict } from "../actions/interfaces";
import { Resource, ResourceLock } from "../engine/resource";
import { Reporter } from "../reporter";
import { QuietReporter } from "../reporter/quiet";

export interface IExternalOptions {
	rulePath?: string;
	cwd?: string;
	jCmd?: number;
	verbosity?: number;
}

export class VerdaConfig implements ActionEnv {
	rulePath: string = "";
	ruleDir: string = "";
	cd: string = process.cwd();
	env: Dict<string> = process.env;
	journal: string = "";
	objectives: string[] = [];
	jCmd: number = 0;
	verbosity: number = 2;
	reporter: Reporter = new QuietReporter();

	constructor(options: IExternalOptions) {
		this.reset(options.rulePath, options.cwd);
		this.jCmd = options.jCmd || os.cpus().length;
		this.verbosity = options.verbosity >= 0 ? options.verbosity : 2;
	}
	reset(rulePath?: string, cwd?: string) {
		if (rulePath) {
			this.rulePath = rulePath;
			this.ruleDir = path.dirname(this.rulePath);
		}
		if (cwd) {
			this.journal = path.join(cwd, ".verda-journal");
			this.cd = cwd;
		}
	}

	private locks: Map<string, ResourceLock> = new Map();
	private __createResource(id: string): ResourceLock {
		if (id === "jCmd") {
			return new Resource(this.jCmd);
		} else {
			return new Resource();
		}
	}
	private _createResource(id: string): ResourceLock {
		if (this.locks.has(id)) return this.locks.get(id);
		let lock = this.__createResource(id);
		this.locks.set(id, lock);
		return lock;
	}
	toCreateResource(id: string): () => ResourceLock {
		return () => this._createResource(id);
	}
}

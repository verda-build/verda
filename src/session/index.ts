import * as fs from "fs-extra";
import Semaphore from "semaphore-async-await";

import { defaultActionKit } from "../actions";
import { IExternalOptions, VerdaConfig } from "../config";
import Director from "../core/director";
import { Goal, OrderGoalTypeList } from "../core/interface";
import { Reporter } from "../reporter";
import ConsoleReporter from "../reporter/console";
import { QuietReporter } from "../reporter/quiet";
import { RedirectReporter } from "../reporter/redirect";
import { bindDefaultRulesAndFunctions, bindDefaultRuleTypes } from "../rule-types";

import { ISession, ISessionLocks } from "./interface";

const selfTrackingID = "Meta::Self-Tracking";

export class Session implements ISession {
	private reporter: Reporter = new QuietReporter();
	private readonly config: VerdaConfig = new VerdaConfig({});
	private director: Director;

	readonly ruleTypes: ReturnType<typeof bindDefaultRuleTypes>;
	readonly rules: ReturnType<typeof bindDefaultRulesAndFunctions>["rules"];
	readonly predefinedFuncs: ReturnType<typeof bindDefaultRulesAndFunctions>["predefinedFuncs"];
	readonly actions: ReturnType<typeof defaultActionKit>;

	readonly locks: SessionLocks;

	userSelfTrackingSet: boolean = false;
	userSelfTrackingGoal: null | Goal<void, any> = null;
	selfTrackingGoal: null | Goal<void, any> = null;

	constructor() {
		this.director = new Director();
		this.director.reporter = this.reporter;

		this.ruleTypes = bindDefaultRuleTypes(this.config, this.director);
		const r = bindDefaultRulesAndFunctions(this.config, this.director);
		this.rules = r.rules;
		this.predefinedFuncs = r.predefinedFuncs;
		this.actions = defaultActionKit(this.config.createActionEnv());

		this.locks = new SessionLocks();
	}

	setSelfTracking(dependency?: null | Goal<void, any>) {
		this.userSelfTrackingSet = true;
		if (dependency) this.userSelfTrackingGoal = dependency;
	}

	setJournal(path: string) {
		this.config.journal = path;
	}
	deleteJournal() {
		this.config.journal = "";
	}

	// Internal methods
	bindConfig(options: IExternalOptions) {
		this.config.bind(options);
		this.director.setCapacity(this.config.jCmd);
		// Enable logging when under TTY
		if (process.stderr.isTTY && process.stdout.isTTY) {
			this.reporter = new ConsoleReporter(this.config.verbosity);
			this.director.reporter = this.reporter;
			this.config.reporter = this.reporter;
		} else {
			this.reporter = new RedirectReporter(this.config.verbosity);
			this.director.reporter = this.reporter;
			this.config.reporter = this.reporter;
		}
	}

	createSelfTrackingRule(dependency?: null | Goal<any, any>) {
		if (!this.config || !this.userSelfTrackingSet) return;
		const rulePath = this.config.rulePath;
		const rulePathGoal = this.rules.fileUpdated`${rulePath}`;
		const stg = this.ruleTypes.SelfTracking(selfTrackingID, async (t) => {
			await t.need(dependency || rulePathGoal);
		});
		this.selfTrackingGoal = stg`${selfTrackingID}`;
	}

	async loadJournal() {
		if (!this.config.journal) return;
		let json: any = null;
		if (await fs.pathExists(this.config.journal)) {
			try {
				json = await fs.readJson(this.config.journal);
			} catch (e) {}
		}
		if (json) json = this.director.fromJson(json);
		if (!json) {
			await fs.ensureFile(this.config.journal);
			await fs.writeFile(this.config.journal, "{}");
		}
	}
	saveJournalSync() {
		if (!this.config.journal) return;
		fs.ensureFileSync(this.config.journal);
		fs.writeFileSync(this.config.journal, JSON.stringify(this.director.toJson(), null, "\t"));
	}

	userCancelSync() {
		const ex = this.director.userCancelSync();
		this.reporter.systemError(ex);
		this.reporter.end(true);
		this.saveJournalSync();
	}

	async start(...args: OrderGoalTypeList) {
		this.reporter.start();
		try {
			if (this.selfTrackingGoal) {
				// Evaluate the self-tracking goal, invalidate the journal
				// if needed
				await this.director.want(this.selfTrackingGoal);
				const objective = this.director.validateGoal(this.selfTrackingGoal);
				if (objective && objective.progress.revision === this.director.buildRev) {
					this.reporter.note("Invalidating build journal due to self-tracking.");
					this.director.invalidateJournal();
					await this.director.want(this.selfTrackingGoal);
				}
			}
			await this.director.want(...args);
		} catch (e) {
			this.reporter.systemError(e);
			this.reporter.end(true);
			throw e;
		}
		this.reporter.end(false);
	}
}

class SessionLocks implements ISessionLocks {
	private m: Map<string, Semaphore> = new Map();

	alloc(key: string, capacity?: number): Semaphore {
		let lock = this.m.get(key);
		if (lock) return lock;
		lock = new Semaphore(capacity || 1);
		this.m.set(key, lock);
		return lock;
	}
}

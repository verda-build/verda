import * as fs from "fs-extra";

import { defaultActionKit } from "../actions";
import { IExternalOptions, VerdaConfig } from "../config";
import Director from "../core/director";
import { Goal, OrderGoalTypeList } from "../core/interface";
import { Reporter } from "../reporter";
import ConsoleReporter from "../reporter/console";
import { QuietReporter } from "../reporter/quiet";
import { bindDefaultRulesAndFunctions, bindDefaultRuleTypes } from "../rule-types";

import { ISession } from "./interface";

const selfTrackingID = "Meta::Self-Tracking";

export class Session implements ISession {
	private reporter: Reporter = new QuietReporter();
	private readonly config: VerdaConfig = new VerdaConfig({});
	private director: Director;
	ruleTypes: ReturnType<typeof bindDefaultRuleTypes>;
	rules: ReturnType<typeof bindDefaultRulesAndFunctions>["rules"];
	predefinedFuncs: ReturnType<typeof bindDefaultRulesAndFunctions>["predefinedFuncs"];
	actions: ReturnType<typeof defaultActionKit>;

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
		}
	}

	createSelfTrackingRule(dependency?: null | Goal<any, any>) {
		if (!this.config || !this.userSelfTrackingSet) return;
		const rulePath = this.config.rulePath;
		const rulePathGoal = this.rules.fileUpdated`${rulePath}`;
		const stg = this.ruleTypes.SelfTracking(selfTrackingID, async t => {
			await t.need(dependency || rulePathGoal);
		});
		this.selfTrackingGoal = stg`${selfTrackingID}`;
	}

	async loadJournal() {
		if (!this.config.journal) return;
		if (await fs.pathExists(this.config.journal)) {
			const json = await fs.readJson(this.config.journal);
			this.director.fromJson(json);
		} else {
			await fs.ensureFile(this.config.journal);
			await fs.writeFile(this.config.journal, "{}");
		}
	}
	async saveJournal() {
		if (!this.config.journal) return;
		await fs.ensureFile(this.config.journal);
		await fs.writeFile(this.config.journal, JSON.stringify(this.director.toJson(), null, "\t"));
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
			this.reporter.end(true);
			throw e;
		}
		this.reporter.end(false);
	}
}

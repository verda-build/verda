import * as fs from "fs-extra";
import { createSandbox } from "../edsl";
import { Bddy2Config } from "../edsl/config";
import { Phony } from "../edsl/rule/phony";
import { Task } from "../edsl/rule/task";
import BuildResolver from "../engine/resolver";
import Target from "../engine/target";
import { Reporter } from "../reporter";
import ConsoleReporter from "../reporter/console";

export class Runner {
	private reporter: Reporter = null;
	private config: Bddy2Config = null;
	private resolver: BuildResolver = null;
	private sandbox: ReturnType<typeof createSandbox> = null;

	configure(config: Bddy2Config) {
		this.config = config;
		this.reporter = new ConsoleReporter(2);
		this.sandbox = createSandbox(config);
		this.resolver = this.sandbox.resolver;
		this.config.reporter = this.reporter;
		this.resolver.reporter = this.reporter;
	}

	inject(context: object) {
		for (const key in this.sandbox) {
			global[key] = this.sandbox[key];
		}
	}

	getSandbox() {
		return this.sandbox;
	}

	setStartTask(startID: string) {
		const wanted = this.config.objectives;
		const start = this.resolver.query(startID);
		this.resolver.defineRule(
			new Phony("meta-start", s => (s === start.id ? [s] : null)).def(async target => {
				await target.need(...wanted);
			})
		);
		return start;
	}

	setSelfTracking(selfTrackingTargetID: string, trackingID: string) {
		const selfTracking = this.resolver.query(selfTrackingTargetID);
		const selfTrackingRule = this.resolver.getRule(selfTracking);
		if (!selfTrackingRule) {
			this.resolver.defineRule(
				new Task("self-tracking", s => (s === selfTracking.id ? [s] : null)).def(
					async target => {
						await target.need(trackingID);
					}
				)
			);
		}
		return selfTracking;
	}

	async loadJournal() {
		if (!this.config.journal) return;
		if (await fs.pathExists(this.config.journal)) {
			const json = await fs.readJson(this.config.journal);
			this.resolver.fromJson(json);
		} else {
			await fs.ensureFile(this.config.journal);
			await fs.writeFile(this.config.journal, "{}");
		}
	}

	async build(start: Target, selfTracking?: Target) {
		try {
			await this.resolver.want(start);
			if (selfTracking) {
				await this.resolver.want(selfTracking);
				this.resolver.setImplicitDependency("user", selfTracking);
			}
		} catch (e) {
			this.reporter.end(true);
			throw e;
		}
		this.reporter.end(false);
	}

	async saveJournal() {
		if (!this.config.journal) return;
		await fs.writeFile(this.config.journal, JSON.stringify(this.resolver.toJson(), null, "\t"));
	}
}

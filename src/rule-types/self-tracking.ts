import Director from "../core/director";
import {
	ExportBuildRecipe,
	ExtBuildContext,
	MatchFunction,
	PreBuildContext,
	PreBuildResult,
	Rule
} from "../core/interface";
import { NonPosixifyPatternMatch } from "../match";

import { RuleBase } from "./rule-base";
import { GoalBuilder } from "./util";

type Args = string[];

class SelfTrackingRule<T> extends RuleBase<Args> implements Rule<T, Args> {
	readonly kindTag = "Builtin::Meta::SelfTrackingRule";
	isUser = false;

	constructor(
		prefix: string,
		pattern: string | MatchFunction<Args>,
		private FRecipe: ExportBuildRecipe<T, Args>
	) {
		super(prefix, pattern instanceof Function ? pattern : NonPosixifyPatternMatch(pattern));
	}

	async build(t: ExtBuildContext<T>, ...args: Args) {
		const result = await this.FRecipe(t, ...args);
		t.is.modified();
		return result;
	}
	async preBuild(t: PreBuildContext<T>) {
		const ud = t.isVolatile || (await t.dependencyModified());
		if (ud) await t.cutoffEarly();
		return ud ? PreBuildResult.YES : PreBuildResult.NO;
	}
	async shouldTriggerModify(t: PreBuildContext<T>, itselfModified: boolean) {
		return itselfModified;
	}
}

export function SelfTracking(dir: Director) {
	return function meta_selfTracking<T>(pattern: string, FRecipe: ExportBuildRecipe<T, Args>) {
		const prefix = "Meta::SelfTracking::";
		const rule = new SelfTrackingRule(prefix, pattern, FRecipe);
		dir.addRule(rule);
		return GoalBuilder<T, Args, string>(rule);
	};
}

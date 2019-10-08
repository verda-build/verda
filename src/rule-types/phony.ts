import Director from "../core/director";
import {
	ExportBuildRecipe,
	ExtBuildContext,
	GoalMatcher,
	PreBuildContext,
	PreBuildResult,
	Rule
} from "../core/interface";
import { NonPosixifyPatternMatch } from "../match";

import { GlobMatcher } from "./matchers";
import { RuleBase } from "./rule-base";
import { SinglePlural_T } from "./util";

type Args = string[];

class PhonyRule<T> extends RuleBase<Args> implements Rule<T, Args> {
	readonly kindTag = "Builtin::PhonyRule";

	constructor(matcher: GoalMatcher<Args>, private FRecipe: ExportBuildRecipe<T, Args>) {
		super(matcher);
	}

	async build(t: ExtBuildContext<T>, ...args: Args) {
		const result = await this.FRecipe(t, ...args);
		t.is.modified();
		return result;
	}
	async preBuild(t: PreBuildContext<T>) {
		return PreBuildResult.YES; // always rerun
	}
	async shouldTriggerModify(t: PreBuildContext<T>, itselfModified: boolean) {
		return itselfModified;
	}
}

export function Phony(dir: Director) {
	const _phony = SinglePlural_T(
		"Builtin::Phony::",
		dir,
		(matcher, FRecipe) => new PhonyRule(matcher, FRecipe)
	);
	return {
		phony: Object.assign(_phony.exact, {
			glob: _phony.glob,
			group: _phony.subPrefix,
			make: _phony.make
		})
	};
}

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
import { SinglePlural_T } from "./util";

type Args = string[];

class PhonyRule<T> extends RuleBase<Args> implements Rule<T, Args> {
	readonly kindTag = "Builtin::PhonyRule";

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
		return PreBuildResult.YES; // always rerun
	}
	async shouldTriggerModify(t: PreBuildContext<T>, itselfModified: boolean) {
		return itselfModified;
	}
}

export function Phony(dir: Director) {
	const _phony = SinglePlural_T<Args>(
		"Builtin::Phony::",
		dir,
		(s: string) => [s],
		(prefix, pattern, FRecipe) => new PhonyRule(prefix, pattern, FRecipe)
	);
	return {
		phony: _phony.exact,
		phonies: Object.assign(_phony.patterned, { group: _phony.subPrefix })
	};
}

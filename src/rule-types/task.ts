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

import { RuleBase } from "./rule-base";
import { SinglePlural_T } from "./util";

type Args = string[];

class TaskRule<T> extends RuleBase<Args> implements Rule<T, Args> {
	readonly kindTag = "Builtin::TaskRule";

	constructor(matcher: GoalMatcher<Args>, private FRecipe: ExportBuildRecipe<T, Args>) {
		super(matcher);
	}

	async build(t: ExtBuildContext<T>, ...args: Args) {
		const result = await this.FRecipe(t, ...args);
		t.is.modified();
		return result;
	}
	async preBuild(t: PreBuildContext<T>) {
		if (t.isVolatile) return PreBuildResult.YES;
		return (await t.dependencyModified()) ? PreBuildResult.YES : PreBuildResult.TIME;
	}
	async shouldTriggerModify(t: PreBuildContext<T>, itselfModified: boolean) {
		return itselfModified;
	}
}

export function Task(dir: Director) {
	const _task = SinglePlural_T(
		"Builtin::Task::",
		dir,
		(matcher, FRecipe) => new TaskRule(matcher, FRecipe)
	);
	return {
		task: Object.assign(_task.exact, {
			glob: _task.glob,
			group: _task.subPrefix,
			make: _task.make
		})
	};
}

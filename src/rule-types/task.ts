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

class TaskRule<T> extends RuleBase<Args> implements Rule<T, Args> {
	readonly kindTag = "Builtin::TaskRule";

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
		if (t.isVolatile) return PreBuildResult.YES;
		return (await t.dependencyModified()) ? PreBuildResult.YES : PreBuildResult.TIME;
	}
	async shouldTriggerModify(t: PreBuildContext<T>, itselfModified: boolean) {
		return itselfModified;
	}
}

export function Task(dir: Director) {
	const _task = SinglePlural_T<Args>(
		"Builtin::Task::",
		dir,
		(s: string) => [s],
		(prefix, pattern, FRecipe) => new TaskRule(prefix, pattern, FRecipe)
	);
	return { task: _task.exact, tasks: Object.assign(_task.patterned, { group: _task.subPrefix }) };
}

import * as equal from "fast-deep-equal";

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
import { GoalBuilder, SinglePlural_T } from "./util";

type Args = string[];

export class OracleRule<T> extends RuleBase<Args> implements Rule<T, Args> {
	readonly kindTag = "Mock::OracleRule";

	constructor(
		private isOracle: boolean,
		prefix: string,
		pattern: string | MatchFunction<Args>,
		private FRecipe: ExportBuildRecipe<T, Args>
	) {
		super(prefix, pattern instanceof Function ? pattern : NonPosixifyPatternMatch(pattern));
	}

	// Oracles never match string intakes - use strongly typed goals instead!
	matchString(id: string) {
		return null;
	}
	async build(t: ExtBuildContext<T>, ...args: Args) {
		const result = await this.FRecipe(t, ...args);
		if (t.lastResult !== undefined && result !== undefined && equal(t.lastResult, result)) {
			t.is.not.modified();
		} else {
			t.is.modified();
		}
		return result;
	}
	async preBuild(t: PreBuildContext<T>) {
		if (this.isOracle || t.isVolatile) {
			await t.dependencyModified();
			return (await t.cutoffEarly()) ? PreBuildResult.YES : PreBuildResult.NO;
		} else {
			if (!(await t.dependencyModified())) return PreBuildResult.NO;
			return (await t.cutoffEarly()) ? PreBuildResult.YES : PreBuildResult.NO;
		}
	}
	async shouldTriggerModify(t: PreBuildContext<T>, itselfModified: boolean) {
		return itselfModified;
	}
}

export function Oracle(dir: Director) {
	const _oracle = SinglePlural_T<Args>(
		"Builtin::Oracle::",
		dir,
		(s: string) => [s],
		(prefix, pattern, FRecipe) => new OracleRule(true, prefix, pattern, FRecipe)
	);
	const _computed = SinglePlural_T<Args>(
		"Builtin::Computed::",
		dir,
		(s: string) => [s],
		(prefix, pattern, FRecipe) => new OracleRule(false, prefix, pattern, FRecipe)
	);
	return {
		oracle: _oracle.exact,
		oracles: Object.assign(_oracle.patterned, { group: _oracle.subPrefix }),
		computed: _computed.exact,
		computes: Object.assign(_computed.patterned, { group: _computed.subPrefix })
	};
}

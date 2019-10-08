import * as equal from "fast-deep-equal";

import Director from "../core/director";
import {
	ExportBuildRecipe,
	ExtBuildContext,
	GoalMatcher,
	PreBuildContext,
	PreBuildResult,
	Rule
} from "../core/interface";

import { RuleBase } from "./rule-base";
import { SinglePlural_T } from "./util";

type Args = string[];

export class OracleRule<T> extends RuleBase<Args> implements Rule<T, Args> {
	readonly kindTag = "Mock::OracleRule";

	constructor(
		private isOracle: boolean,
		matcher: GoalMatcher<Args>,
		private FRecipe: ExportBuildRecipe<T, Args>
	) {
		super(matcher);
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
	const _oracle = SinglePlural_T(
		"Builtin::Oracle::",
		dir,
		(matcher, FRecipe) => new OracleRule(true, matcher, FRecipe)
	);
	const _computed = SinglePlural_T(
		"Builtin::Computed::",
		dir,
		(matcher, FRecipe) => new OracleRule(false, matcher, FRecipe)
	);
	return {
		oracle: Object.assign(_oracle.exact, {
			glob: _oracle.glob,
			group: _oracle.subPrefix,
			make: _oracle.make
		}),
		computed: Object.assign(_computed.exact, {
			glob: _computed.glob,
			group: _computed.subPrefix,
			make: _computed.make
		})
	};
}

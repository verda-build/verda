import { VerdaConfig } from "../config";
import Director from "../core/director";
import { ExportBuildRecipe, Goal, GoalMatcher, Rule } from "../core/interface";

import {
	AlwaysMatcher,
	ExactMatcher,
	FileExecArgs,
	FilePathMatcherT,
	GlobMatcher,
	KindMatcherT,
	MakeMatcher,
	PrefixMatcherT
} from "./matchers";
import { RuleBase } from "./rule-base";

export function GoalBuilder<T, A extends any[], F>(matcher: GoalMatcher<A>, rule: Rule<T, A>) {
	return function(literals: string | TemplateStringsArray, ...placeholders: F[]): Goal<T, A> {
		if (typeof literals === "string") {
			const ob = matcher.createGoalIdFromArgs([literals]);
			return { ...ob, rule };
		} else {
			let result = "";

			// interleave the literals with the placeholders
			for (let i = 0; i < placeholders.length; i++) {
				result += literals[i];
				result += placeholders[i];
			}

			// add the last literal
			result += literals[literals.length - 1];
			const ob = matcher.createGoalIdFromArgs([result]);
			return { ...ob, rule };
		}
	};
}

export function MakeGoalBuilder<T, A extends any[], K extends string[]>(
	matcher: GoalMatcher<A>,
	rule: Rule<T, A>
) {
	return function(...args: K): Goal<T, A> {
		return { ...matcher.createGoalIdFromArgs(args), rule };
	};
}

export function SinglePlural_F<R, T>(
	rulePrefix: string,
	dir: Director,
	cfg: VerdaConfig,
	RuleBuilder: (
		matcher: GoalMatcher<FileExecArgs>,
		FRecipe: ExportBuildRecipe<R, FileExecArgs>
	) => RuleBase<FileExecArgs> & Rule<T, FileExecArgs>
) {
	const glob = function(pattern: string, FRecipe: ExportBuildRecipe<R, FileExecArgs>) {
		const matcher = new KindMatcherT(
			rulePrefix,
			new FilePathMatcherT(cfg, new GlobMatcher(pattern))
		);
		const rule = RuleBuilder(matcher, FRecipe);
		dir.addRule(rule);
		return GoalBuilder(matcher, rule);
	};
	const exact = function(pattern: string, FRecipe: ExportBuildRecipe<R, FileExecArgs>) {
		const matcher = new KindMatcherT(
			rulePrefix,
			new FilePathMatcherT(cfg, new ExactMatcher(pattern))
		);
		const rule = RuleBuilder(matcher, FRecipe);
		dir.addRule(rule);
		return GoalBuilder(matcher, rule)(pattern);
	};
	const make = function<K extends string[]>(
		mk: (...args: K) => string,
		FRecipe: ExportBuildRecipe<R, FileExecArgs>
	) {
		const matcher = new KindMatcherT(
			rulePrefix,
			new FilePathMatcherT(cfg, new MakeMatcher(mk))
		);
		const rule = RuleBuilder(matcher, FRecipe);
		dir.addRule(rule);
		return MakeGoalBuilder<T, FileExecArgs, K>(matcher, rule);
	};

	return { glob, exact, make };
}

export function SinglePlural_T(
	rulePrefix: string,
	dir: Director,
	RuleBuilder: <T>(
		pattern: GoalMatcher<string[]>,
		FRecipe: ExportBuildRecipe<T, string[]>
	) => RuleBase<string[]> & Rule<T, string[]>
) {
	const glob = function<T>(pattern: string, FRecipe: ExportBuildRecipe<T, string[]>) {
		const matcher = new KindMatcherT(rulePrefix, new GlobMatcher(pattern));
		const rule = RuleBuilder<T>(matcher, FRecipe);
		dir.addRule(rule);
		return GoalBuilder(matcher, rule);
	};
	const exact = function<T>(pattern: string, FRecipe: ExportBuildRecipe<T, string[]>) {
		const matcher = new KindMatcherT(rulePrefix, new ExactMatcher(pattern));
		const rule = RuleBuilder<T>(matcher, FRecipe);
		dir.addRule(rule);
		return GoalBuilder(matcher, rule)(pattern);
	};
	const subPrefix = function<T>(_subPrefix: string, FRecipe: ExportBuildRecipe<T, string[]>) {
		const subPrefix = _subPrefix + "::";
		const matcher = new KindMatcherT(
			rulePrefix,
			new PrefixMatcherT(subPrefix, new AlwaysMatcher())
		);
		const rule = RuleBuilder<T>(matcher, FRecipe);
		dir.addRule(rule);
		return GoalBuilder(matcher, rule);
	};
	const make = function<T, K extends string[]>(
		mk: (...args: K) => string,
		FRecipe: ExportBuildRecipe<T, string[]>
	) {
		const matcher = new KindMatcherT(rulePrefix, new MakeMatcher(mk));
		const rule = RuleBuilder(matcher, FRecipe);
		dir.addRule(rule);
		return MakeGoalBuilder<T, string[], K>(matcher, rule);
	};
	return { glob, exact, subPrefix, make };
}

import Director from "../core/director";
import { ExportBuildRecipe, Goal, MatchFunction, Rule } from "../core/interface";

import { RuleBase } from "./rule-base";

export function GoalBuilder<T, A extends any[], F>(rule: Rule<T, A>, subPrefix: string = "") {
	return function(literals: string | TemplateStringsArray, ...placeholders: F[]): Goal<T, A> {
		if (typeof literals === "string") {
			return { id: rule.createGoalID(subPrefix + literals), rule };
		}
		let result = "";

		// interleave the literals with the placeholders
		for (let i = 0; i < placeholders.length; i++) {
			result += literals[i];
			result += placeholders[i];
		}

		// add the last literal
		result += literals[literals.length - 1];
		return { id: rule.createGoalID(subPrefix + result), rule };
	};
}

export function SinglePlural_F<R, T, Z extends any[], A extends any[]>(
	rulePrefix: string,
	dir: Director,
	pure: (id: string) => Z,
	RuleBuilder: (
		prefix: string,
		pattern: string | MatchFunction<Z>,
		FRecipe: ExportBuildRecipe<R, A>
	) => RuleBase<A> & Rule<T, A>
) {
	const patterned = function(
		pattern: string | MatchFunction<Z>,
		FRecipe: ExportBuildRecipe<R, A>
	) {
		const rule = RuleBuilder(rulePrefix, pattern, FRecipe);
		dir.addRule(rule);
		return GoalBuilder<T, A, string>(rule);
	};
	const exact = function(pattern: string, FRecipe: ExportBuildRecipe<R, A>) {
		const rule = RuleBuilder(rulePrefix, s => (s === pattern ? pure(s) : null), FRecipe);
		dir.addRule(rule);
		return GoalBuilder<T, A, string>(rule)(pattern);
	};

	return { patterned, exact };
}

export function SinglePlural_T<A extends any[]>(
	rulePrefix: string,
	dir: Director,
	pure: (id: string) => A,
	RuleBuilder: <T>(
		prefix: string,
		pattern: string | MatchFunction<A>,
		FRecipe: ExportBuildRecipe<T, A>
	) => RuleBase<A> & Rule<T, A>
) {
	const patterned = function<T>(
		pattern: string | MatchFunction<A>,
		FRecipe: ExportBuildRecipe<T, A>
	) {
		const rule = RuleBuilder<T>(rulePrefix, pattern, FRecipe);
		dir.addRule(rule);
		return GoalBuilder<T, A, string>(rule);
	};
	const exact = function<T>(pattern: string, FRecipe: ExportBuildRecipe<T, A>) {
		const rule = RuleBuilder<T>(rulePrefix, s => (s === pattern ? pure(s) : null), FRecipe);
		dir.addRule(rule);
		return GoalBuilder<T, A, string>(rule)(pattern);
	};
	const subPrefix = function<T>(_subPrefix: string, FRecipe: ExportBuildRecipe<T, A>) {
		const subPrefix = _subPrefix + "::";
		const rule = RuleBuilder(
			rulePrefix,
			s => (s.startsWith(subPrefix) ? pure(s.slice(subPrefix.length)) : null),
			FRecipe
		);
		dir.addRule(rule);
		return GoalBuilder<T, A, string>(rule, subPrefix);
	};
	return { patterned, exact, subPrefix };
}

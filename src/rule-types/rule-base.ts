import { GoalMatcher, RuleMatchResult } from "../core/interface";

export abstract class RuleBase<A extends any[]> {
	protected abstract kindTag: string;
	protected goalMatcher: GoalMatcher<A>;

	isUser: boolean = true;
	ignoreStringMatch: boolean = false;

	constructor(mf: GoalMatcher<A>) {
		this.goalMatcher = mf;
	}

	matchString(id: string): null | RuleMatchResult<A> {
		return this.goalMatcher.matchString(id);
	}
	matchGoalID(id: string, args: string[]): null | RuleMatchResult<A> {
		return this.goalMatcher.matchGoalID(id, args);
	}
}

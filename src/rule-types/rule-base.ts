import { MatchFunction } from "../core/interface";

export abstract class RuleBase<A extends any[]> {
	protected abstract kindTag: string;
	protected matchFunction: MatchFunction<A>;
	protected ruleIDPrefix: string;

	isUser: boolean = true;
	ignoreStringMatch: boolean = false;

	constructor(prefix: string, mf: MatchFunction<A>) {
		this.matchFunction = mf;
		this.ruleIDPrefix = prefix;
	}

	matchString(id: string): null | A {
		if (this.ignoreStringMatch) return null;
		return this.matchFunction(id);
	}
	matchGoalID(id: string): null | A {
		if (!this.ruleIDPrefix) {
			return this.matchFunction(id);
		} else if (id.startsWith(this.ruleIDPrefix)) {
			return this.matchFunction(id.slice(this.ruleIDPrefix.length));
		} else {
			return null;
		}
	}
	createGoalID(id: string) {
		return this.ruleIDPrefix + id;
	}
}

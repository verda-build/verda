import { defaultActionKit } from "../actions";
import { Goal } from "../core/interface";
import { bindDefaultRulesAndFunctions, bindDefaultRuleTypes } from "../rule-types";

export interface ISession {
	ruleTypes: ReturnType<typeof bindDefaultRuleTypes>;
	rules: ReturnType<typeof bindDefaultRulesAndFunctions>["rules"];
	predefinedFuncs: ReturnType<typeof bindDefaultRulesAndFunctions>["predefinedFuncs"];
	actions: ReturnType<typeof defaultActionKit>;
	setSelfTracking(dependency?: null | Goal<void, any>): void;
	setJournal(path: string): void;
	deleteJournal(): void;
}

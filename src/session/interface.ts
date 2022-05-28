import Semaphore from "semaphore-async-await";
import { defaultActionKit } from "../actions";
import { Goal } from "../core/interface";
import { bindDefaultRulesAndFunctions, bindDefaultRuleTypes } from "../rule-types";

export interface ISession {
	readonly ruleTypes: ReturnType<typeof bindDefaultRuleTypes>;
	readonly rules: ReturnType<typeof bindDefaultRulesAndFunctions>["rules"];
	readonly predefinedFuncs: ReturnType<typeof bindDefaultRulesAndFunctions>["predefinedFuncs"];
	readonly actions: ReturnType<typeof defaultActionKit>;
	setSelfTracking(dependency?: null | Goal<void, any>): void;
	setJournal(path: string): void;
	deleteJournal(): void;

	readonly locks: ISessionLocks;
}

export interface ISessionLocks {
	alloc(key: string, capacity?: number): Semaphore;
}

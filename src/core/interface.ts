// JSON datatype
export interface JsonMap {
	[member: string]: string | number | boolean | null | JsonArray | JsonMap;
}
export interface JsonArray extends Array<string | number | boolean | null | JsonArray | JsonMap> {}
export type Json = JsonMap | JsonArray | string | number | boolean | null;

// Dep
export type Dependency = { readonly id: string; readonly args: string[] };

// Rule
export type RuleMatchResult<A> = null | (Dependency & { execArgs: A });
export interface Rule<T, A extends any[]> {
	readonly kindTag: string;
	readonly isUser: boolean;
	matchString(id: string): RuleMatchResult<A>;
	matchGoalID(id: string, args: string[]): RuleMatchResult<A>;
	build(t: ExtBuildContext<T>, ...args: A): Promise<T>;
	preBuild(t: PreBuildContext<T>, ...args: A): Promise<PreBuildResult>;
}

// Goal
export type GoalFunction<T, A extends any[]> = (
	literals: string | TemplateStringsArray,
	...placeholders: string[]
) => Goal<T, A>;
export interface Goal<T, A extends any[]> extends Dependency {
	readonly rule: Rule<T, A>;
}

// Progress
export enum BuildStatus {
	NOT_STARTED = 0,
	STARTED = 1,
	FINISHED = 2,
	ERROR = 3,
	HALT = 4,
}
export enum PreBuildResult {
	NO = 0,
	TIME = 1,
	YES = 2,
}
export enum PreBuildStatus {
	UNKNOWN = 0,
	CHECKING = 1,
	DECIDED = 2,
}

export interface Progress<T> {
	readonly id: string;
	readonly isUser: boolean;
	readonly status: BuildStatus;
	readonly preBuildStatus: PreBuildStatus;
	readonly preBuildResult: PreBuildResult;
	readonly dependencies: Dependency[][];
	readonly volatile: boolean;
	readonly lastResult: undefined | T;
	readonly result: undefined | T;
	readonly revision: number;
}

// EDSL
export type PrimOrderGoalType = undefined | null | string | Goal<any, any>;
export type OrderGoalType = PrimOrderGoalType | OrderGoalTypeList;
export interface OrderGoalTypeList extends Array<OrderGoalType> {}

export type MapGoalType<T> = T extends undefined
	? undefined
	: T extends null
	? null
	: T extends Goal<infer R, infer A>
	? R
	: T extends Array<infer RS>
	? MapGoalTuple<T>
	: Json;
export type MapGoalTuple<TS> = { [K in keyof TS]: MapGoalType<TS[K]> };

export interface ProgressIs {
	readonly not: ProgressIs;
	volatile(): void;
	modified(): void;
}
export interface BuildContext {
	// Flag setter
	readonly is: ProgressIs;
	// Order
	order<TS extends OrderGoalTypeList>(...targets: TS): Promise<MapGoalTuple<TS>>;
	// Check
	needed<TS extends OrderGoalTypeList>(...targets: TS): void;
	// And both
	need<TS extends OrderGoalTypeList>(...targets: TS): Promise<MapGoalTuple<TS>>;
}
export interface ExtBuildContext<T> extends BuildContext {
	readonly id: string;
	readonly lastResult: undefined | T;
}
export interface PreBuildContext<T> {
	readonly isVolatile: boolean;
	readonly lastResult: undefined | T;

	dependencyModified(): Promise<boolean>;
	cutoffEarly(): Promise<boolean>;
}
export type ExportBuildRecipe<T, A extends any[]> = (t: BuildContext, ...args: A) => Promise<T>;

// Patterns
export interface GoalMatcher<A> {
	createGoalIdFromArgs(args: string[]): Dependency & { execArgs: A };
	matchString(id: string): RuleMatchResult<A>;
	matchGoalID(id: string, args: string[]): RuleMatchResult<A>;
}

// Arbitration
export interface Arbitrator {
	setCapacity(cap: number): void;
	start<T>(p: Progress<T>): Promise<void>;
	end<T>(p: Progress<T>, err: null | Error): Promise<void>;
	halt<T>(p: Progress<T>): Promise<void>;
	unhalt<T>(p: Progress<T>): Promise<void>;
}

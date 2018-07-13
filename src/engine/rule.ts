import { ITargetCheckModification, ITargetExec, ITargetInfo } from "./interfaces";

export type MatchFunction = (s: string) => string[];
export type UnboundRule = (t: ITargetExec, ...args: string[]) => Promise<any>;
export type BoundRule = () => Promise<any>;

export type ModifiedChecker = (
	anyDependencyUpdated: ITargetCheckModification,
	...args: string[]
) => Promise<boolean>;

export type TriggerChecker = (
	thisTargetChanged: boolean,
	thisTarget: ITargetCheckModification,
	thatTarget: ITargetInfo
) => Promise<boolean>;

export interface Rule {
	kind: string;
	match: MatchFunction;
	exec: UnboundRule;
	checkModified: ModifiedChecker;
	shouldTriggerModify: TriggerChecker;
}

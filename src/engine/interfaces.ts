import { Reporter } from "../reporter";

export interface IResolver<T> {
	reporter?: Reporter;
	query(s: string): T;
	buildTarget(target: T): Promise<any>;
	checkModified(target: T, against: T): Promise<boolean>;
}

export enum BuildStatus {
	NOT_STARTED = 0,
	STARTED = 1,
	FINISHED = 2,
	ERROR = 3
}

export enum ModifiedCheckStatus {
	UNKNOWN = 0,
	CHECKING = 1,
	YES = 2,
	NO = 3
}

export type ArgList<T> = (string | T | Iterable<string | T>)[];

export interface ITargetInfo {
	readonly id: string;
	readonly dependencies: Set<ITargetInfo>[];
	readonly implicitDependencies: Set<ITargetInfo>;
	readonly volatile: boolean;
	readonly tracking: any;
	readonly updated: Date;
}

export interface ITargetExec {
	readonly id: string;
	is: ITargetIs;

	// Tracking
	readonly tracking: any;
	track<T>(x: T): T;
	trackModification<R, T extends R>(x: T, compare?: (tracking: R, x: R) => boolean): R;

	// Order-only dependency, forced
	order(...targets: ArgList<ITargetInfo>): Promise<any[]>;
	// Mark-only dependency
	needed(...targets: ArgList<ITargetInfo>);
	// Mark, order and placid
	need(...targets: ArgList<ITargetInfo>): Promise<any[]>;
}

export interface ITargetCheckModification extends ITargetInfo {
	dependencyModified(): Promise<boolean>;
	cutoffEarly(): Promise<boolean>;
}

export interface ITargetIs {
	placid();
	volatile();
	modified();
	updatedAt(time: Date);
}

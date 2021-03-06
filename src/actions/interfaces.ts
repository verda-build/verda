import { Reporter } from "../reporter";

export type Dict<T> = { [key: string]: T };

export interface ActionEnv {
	readonly cd: string;
	readonly env: Dict<string | undefined>;
	readonly cwd: string;
	readonly rulePath: string;
	readonly reporter: Reporter;
}

export interface DeepArray<T> extends Array<T | DeepArray<T>> {}

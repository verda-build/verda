import { ParsedPath } from "../match/interface";

export interface FileStatInfo extends ParsedPath {
	readonly present: boolean;
	readonly updated: string;
	readonly hash: string;
}

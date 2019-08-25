export interface ParsedPath {
	readonly prefix: string;
	readonly full: string;
	readonly root: string;
	readonly dir: string;
	readonly name: string;
	readonly ext: string;
	readonly base: string;
	readonly $: string[];
}
export interface DirContents {
	[key: string]: string | DirContents;
}

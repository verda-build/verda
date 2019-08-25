import { ParsedPath } from "./interface";
import posixifyPath from "./posixify-path";

const splitPathRe = /^([a-zA-Z\-:]+:|)(\/|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;

export default class ParsedPathImpl implements ParsedPath {
	readonly prefix: string;
	readonly full: string;
	readonly root: string;
	readonly dir: string;
	readonly name: string;
	readonly ext: string;
	readonly base: string;

	constructor(_s: string, readonly $: string[] = []) {
		const s = posixifyPath(_s);
		const allParts = splitPathRe.exec(s);
		if (!allParts || allParts.length !== 6) {
			throw new TypeError("Invalid path '" + s + "'");
		}
		allParts[1] = allParts[1] || "";
		allParts[2] = allParts[2] || "";
		allParts[3] = allParts[3] || "";
		allParts[4] = allParts[4] || "";
		allParts[5] = allParts[5] || "";

		this.full = s;
		this.prefix = allParts[1];
		this.root = allParts[2];
		this.dir = allParts[3].slice(0, -1);
		this.base = allParts[4];
		this.ext = allParts[5];
		this.name = this.base.slice(0, this.base.length - this.ext.length);
	}
}

import chalk, { ChalkInstance } from "chalk";
import * as util from "util";

export interface ActionLogHighlighter {
	styledTrail: string;
	trail: string;
	joiner(lineNo: number): string;
	escape(term: any, lineNo: number, termNo: number): string;
	stylize(term: any, lineNo: number, termNo: number, text: string, slicedText: string): string;
}

export const commandStylizer: ActionLogHighlighter = {
	trail: "...",
	styledTrail: chalk.gray("..."),
	joiner(line) {
		return line > 0 ? "|" : "";
	},
	escape(term: any, lineNo: number, termNo: number) {
		return typeof term === "string"
			? /[ ']/.test(term)
				? "'" + term.replace(/[\\']/g, "\\$&") + "'"
				: term
			: util.inspect(term) || "";
	},
	stylize(term: any, lineNo: number, termNo: number, text: string, slicedText: string): string {
		if (termNo === -1) return chalk.cyanBright(slicedText);
		if (termNo === 0) return chalk.blueBright.underline(slicedText);
		if (typeof term !== "string") return slicedText;
		if (/^-/.test(text)) return chalk.yellow(slicedText);
		if (/^'/.test(text)) return chalk.green(slicedText);
		return slicedText;
	},
};

export const jsCallStyle: ActionLogHighlighter = {
	trail: "...",
	styledTrail: chalk.gray("..."),
	joiner(line) {
		return "";
	},
	escape(term: any, lineNo: number, termNo: number) {
		return JSON.stringify(term) || "";
	},
	stylize(term: any, lineNo: number, termNo: number, text: string, slicedText: string): string {
		if (termNo === 0) return chalk.blueBright.underline(slicedText);
		return slicedText;
	},
};

export class HighlightedRun {
	constructor(readonly style: string, readonly text: unknown) {}
	resolve() {
		const s = HighlightedRun.styleMap[this.style];
		if (s) return s(String(this.text));
		else return String(this.text);
	}

	private static styleMap: { [style: string]: ChalkInstance | undefined } = Object.create(null, {
		directive: { value: chalk.cyanBright },
		operator: { value: chalk.cyan },
		command: { value: chalk.blueBright },
		param: { value: chalk.yellow },
		quote: { value: chalk.green },
		numeric: { value: chalk.magentaBright },
	});
}
export const defaultStylizer: ActionLogHighlighter = {
	trail: "...",
	styledTrail: chalk.gray("..."),
	joiner(line) {
		return "";
	},
	escape(term: any, lineNo: number, termNo: number) {
		if (term instanceof HighlightedRun) {
			return String(term.text);
		} else {
			return String(term);
		}
	},
	stylize(term: any, lineNo: number, termNo: number, text: string, slicedText: string): string {
		if (term instanceof HighlightedRun) {
			return term.resolve();
		} else {
			return slicedText;
		}
	},
};

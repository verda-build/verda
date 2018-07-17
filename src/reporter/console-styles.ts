import chalk from "chalk";
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
		if (termNo === 0) return chalk.blue.underline(slicedText);
		if (typeof term !== "string") return slicedText;
		if (/^-/.test(text)) return chalk.yellow(slicedText);
		if (/^'/.test(text)) return chalk.green(slicedText);
		return slicedText;
	}
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
		if (termNo === 0) return chalk.blue.underline(slicedText);
		return slicedText;
	}
};

export const defaultStylizer: ActionLogHighlighter = {
	trail: "...",
	styledTrail: chalk.gray("..."),
	joiner(line) {
		return "";
	},
	escape(term: any, lineNo: number, termNo: number) {
		return term + "";
	},
	stylize(term: any, lineNo: number, termNo: number, text: string, slicedText: string): string {
		return slicedText;
	}
};

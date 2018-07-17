import chalk from "chalk";
import * as ora from "ora";
import * as util from "util";

import { Reporter } from ".";
import {
	ActionLogHighlighter,
	commandStylizer,
	defaultStylizer,
	jsCallStyle
} from "./console-styles";

export default class ConsoleReporter implements Reporter {
	private level: number;
	private spinner: ReturnType<typeof ora>;
	private columns: number;
	private activeTargets: Set<string> = new Set();
	private finishedTargets: Set<string> = new Set();
	private reportedErrors: Set<Error> = new Set();

	constructor(level: number, parent?: ConsoleReporter) {
		this.level = level;
		if (!parent) {
			this.spinner = ora("Building");
		} else {
			this.spinner = parent.spinner;
		}
		this.columns = (process.stdout.columns || 80) - 2;
	}

	start() {
		this.activeTargets = new Set();
		this.finishedTargets = new Set();
		this.reportedErrors = new Set();
		this.spinner.start();
	}
	private beforeOutput() {
		this.spinner.stop();
	}
	private afterOutput() {
		this.spinner.start();
	}
	end(wrong?: boolean) {
		if (wrong) {
			this.spinner.text = chalk.red("Building process terminated.");
		} else {
			this.spinner.text = chalk.cyan(
				`Finished with ${this.finishedTargets.size} targets updated.`
			);
		}
		this.spinner.stopAndPersist();
	}

	targetStart(id, kind) {
		if (this.activeTargets.has(id) || this.finishedTargets.has(id) || kind !== "user") return;
		this.info("Start building", id);
		this.activeTargets.add(id);
		this.spinner.text = chalk.cyan(
			`Building target ${this.finishedTargets.size} / ${this.finishedTargets.size +
				this.activeTargets.size}.`
		);
	}
	targetSkip(id, kind) {}
	targetEnd(id) {
		if (!this.activeTargets.has(id)) return;
		this.info("Finish building", id);
		this.activeTargets.delete(id);
		this.finishedTargets.add(id);
		this.spinner.text = chalk.cyan(
			`Building target ${this.finishedTargets.size} / ${this.finishedTargets.size +
				this.activeTargets.size}.`
		);
	}
	targetError(id, err) {
		if (this.reportedErrors.has(err)) return;
		this.error(`Unhandled exception when building "${id}":\n`, chalk.gray(util.inspect(err)));
		this.reportedErrors.add(err);
	}

	rawLog(...line: any[]) {
		this.beforeOutput();
		console.error(...line);
		this.afterOutput();
	}
	redirectStdout(line: string | Buffer) {
		if (!line.length) return;
		this.beforeOutput();
		process.stdout.write(line);
		this.afterOutput();
	}
	redirectStderr(line: string | Buffer) {
		if (!line.length) return;
		this.beforeOutput();
		process.stderr.write(line);
		this.afterOutput();
	}

	private directive(color: string, symbol: string, word: string) {
		return chalk[color](symbol + (word ? " " + chalk.underline.bold(word) : ""));
	}

	private extractFirstLine(lines: any[][], len: number, style: ActionLogHighlighter) {
		let s = "";
		let lengthSofar = 0;
		for (let j = 0; j < lines.length; j++) {
			let line = lines[j];
			const joiner = style.joiner(j);
			let kShift = 0;
			if (joiner) {
				line = [joiner, ...line];
				kShift = 1;
			}
			for (let k = 0; k < line.length; k++) {
				const term = line[k];
				let segText = style.escape(term, j, k).replace(/[\r\n]+/g, " ");
				if (lengthSofar + segText.length >= len) {
					const remainingLength = len - lengthSofar - style.trail.length;
					if (remainingLength > 0) {
						const segText1 = segText.slice(0, remainingLength);
						s +=
							style.stylize(term, j, k - kShift, segText, segText1) +
							style.styledTrail;
					}
					return s;
				} else {
					s += style.stylize(term, j, k - kShift, segText, segText) + " ";
					lengthSofar += segText.length + 1;
				}
			}
		}
		return s;
	}

	private getStyle(s: string) {
		switch (s) {
			case "command":
				return commandStylizer;
			case "jsCall":
				return jsCallStyle;
			default:
				return defaultStylizer;
		}
	}

	actions(commands: string[][], style?: string) {
		if (this.level > 2) return;
		this.rawLog(
			this.directive("blue", "♦", ""),
			this.extractFirstLine(commands, this.columns, this.getStyle(style))
		);
	}

	// Directive logging
	private directiveLogging(directive: string, color: string, ...args: any[]) {
		const [prefix, postfix] = color
			? chalk[color]("<<##BEGIN##>>").split("<<##BEGIN##>>")
			: ["", ""];
		this.beforeOutput();
		if (directive) {
			process.stderr.write(directive + " " + prefix);
		} else {
			process.stderr.write(prefix);
		}
		console.error(...args);
		process.stderr.write(postfix);
		this.afterOutput();
	}

	debug(...line: any[]) {
		if (this.level > 0) return;
		this.directiveLogging(this.directive("gray", "·", "Debug"), "gray", ...line);
	}
	info(...line: any[]) {
		if (this.level > 1) return;
		this.directiveLogging(this.directive("gray", "·", ""), "gray", ...line);
	}
	echo(...line: any[]) {
		if (this.level > 3) return;
		this.directiveLogging("", "", ...line);
	}
	note(...line: any[]) {
		if (this.level > 3) return;
		this.directiveLogging(this.directive("cyan", "●", "Note"), "", ...line);
	}
	warn(...line: any[]) {
		if (this.level > 4) return;
		this.directiveLogging(this.directive("yellow", "!", "Warning"), "", ...line);
	}
	success(...line: any[]) {
		if (this.level > 5) return;
		this.directiveLogging(this.directive("green", "√", "Success"), "", ...line);
	}
	fail(...line: any[]) {
		if (this.level > 5) return;
		this.directiveLogging(this.directive("red", "×", "Fail"), "", ...line);
	}
	error(...line: any[]) {
		if (this.level > 6) return;
		this.directiveLogging(this.directive("red", "×", "Error"), "", ...line);
	}
	fatal(...line: any[]) {
		if (this.level > 7) return;
		this.directiveLogging(this.directive("red", "×", "Fatal"), "", ...line);
	}
}

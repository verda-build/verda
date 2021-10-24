import chalk from "chalk";
import * as util from "util";

import { getExtErrorProps } from "../errors";

import { Reporter } from "./index";
import {
	ActionLogHighlighter,
	commandStylizer,
	defaultStylizer,
	jsCallStyle,
} from "./console-styles";
import Spinner, { SpinnerTextSource } from "./spinner";
import { CpuStats, MemStats } from "./stat";

class DigitHistory {
	constructor(public d = 0) {}
}

class ConsoleReporterTextSource implements SpinnerTextSource {
	running: boolean = false;
	message: string = "";
	private cpuStat = new CpuStats();
	private memStat = new MemStats();

	private dCPU = new DigitHistory(3);
	private dProg = new DigitHistory(2);
	private dFin = new DigitHistory(0);
	private dExec = new DigitHistory(0);
	private showProgress = process.stderr.columns && process.stderr.columns >= 120;

	private chromaPad(
		value: number,
		dh: DigitHistory,
		bright: (s: string) => string,
		grayOut: (s: string) => string
	) {
		const valStr = (value || 0).toFixed(0);
		if (valStr.length > dh.d) dh.d = valStr.length;
		let pad: string = "",
			padDigits = 0;
		while (valStr.length + padDigits < dh.d) {
			pad += grayOut("0");
			padDigits += 1;
		}
		return pad + bright(valStr);
	}

	private progressBar(
		usage: number,
		size: number,
		bright: (s: string) => string,
		dark: (s: string) => string
	) {
		let bar: string = "";
		for (let s = 0; s < size; s++) {
			const thr = (s + 1 / 2) / size;
			bar += usage > thr ? bright("█") : dark("▒");
		}
		return bar;
	}

	private percentage(
		usage: number,
		dh: DigitHistory,
		bright: (s: string) => string,
		dark: (s: string) => string,
		grayOut: (s: string) => string,
		strict1?: boolean
	) {
		const p = strict1 ? Math.floor(usage * 100) : Math.round(usage * 100);
		return this.chromaPad(p, dh, bright, grayOut) + dark("%");
	}

	private resourceUsage(name: string, usage: number, dh: DigitHistory) {
		return (
			chalk.greenBright(name) +
			chalk.gray(":") +
			this.percentage(usage, dh, chalk.greenBright, chalk.green, chalk.gray) +
			(this.showProgress
				? " " + this.progressBar(usage, 10, chalk.greenBright, chalk.green)
				: "")
		);
	}

	private resourceText() {
		return (
			" | " +
			this.resourceUsage("CPU", this.cpuStat.getTotalCpuUsage(), this.dCPU) +
			" - " +
			this.resourceUsage("RAM", this.memStat.getMemoryUsage(), this.dCPU)
		);
	}

	standardProgress(finished: number, executing: number, awaiting: number) {
		const progress = finished / (finished + executing + awaiting) || 0;
		let r =
			chalk.cyan("Complete ") +
			this.chromaPad(finished, this.dFin, chalk.cyanBright, chalk.gray) +
			" - " +
			chalk.yellow("Executing ") +
			this.chromaPad(executing, this.dExec, chalk.yellowBright, chalk.gray) +
			" - " +
			chalk.cyan("Pending ") +
			this.chromaPad(awaiting, this.dFin, chalk.cyanBright, chalk.gray) +
			chalk.cyan(" (") +
			this.percentage(progress, this.dProg, chalk.cyanBright, chalk.cyan, chalk.gray, true) +
			chalk.cyan(")");
		if (this.showProgress) {
			r += " " + this.progressBar(progress, 20, chalk.cyanBright, chalk.cyan);
		}
		return r;
	}

	getText() {
		return this.message + (this.running ? this.resourceText() : "");
	}
}

export default class ConsoleReporter implements Reporter {
	public verbosity: number;
	private spinner: Spinner;
	private text: ConsoleReporterTextSource;
	private columns: number;

	private activeTargets: Set<string> = new Set();
	private finishedTargets: Set<string> = new Set();
	private reportedErrors: Set<Error> = new Set();
	private targetHalts: Set<string> = new Set();

	constructor(verbosity: number, parent?: ConsoleReporter) {
		this.verbosity = verbosity;
		if (!parent) {
			this.spinner = new Spinner();
			this.text = new ConsoleReporterTextSource();
			this.spinner.textSource = this.text;
		} else {
			this.spinner = parent.spinner;
			this.text = parent.text;
		}
		this.columns = (process.stdout.columns || 80) - 2;
	}

	start() {
		this.activeTargets = new Set();
		this.finishedTargets = new Set();
		this.reportedErrors = new Set();
		this.spinner.start();
		this.text.running = true;
	}
	private beforeOutput() {
		this.spinner.pause();
	}
	private afterOutput() {
		this.spinner.start();
	}
	end(wrong?: boolean) {
		if (wrong) {
			this.text.message = chalk.red("Building process terminated.");
		} else {
			this.text.message = chalk.cyan(
				`Finished with ${this.finishedTargets.size} targets updated.`
			);
		}
		this.text.running = false;
		this.spinner.stop();
	}

	private progressMessage() {
		const executing = Math.max(
			0,
			Math.min(this.activeTargets.size, this.activeTargets.size - this.targetHalts.size)
		);
		const awaiting = this.activeTargets.size - executing;
		const finished = this.finishedTargets.size;
		this.text.message = this.text.standardProgress(finished, executing, awaiting);
	}

	targetStart(id: string) {
		if (this.activeTargets.has(id) || this.finishedTargets.has(id)) return;
		this.info("Start building", id);
		this.activeTargets.add(id);
		this.progressMessage();
	}
	targetSkip(id: string) {
		this.finishedTargets.add(id);
		this.progressMessage();
	}
	targetEnd(id: string) {
		if (!this.activeTargets.has(id)) return;
		this.info("Finish building", id);
		this.activeTargets.delete(id);
		this.targetHalts.delete(id);
		this.finishedTargets.add(id);
		this.progressMessage();
	}
	systemError(err: Error) {
		if (this.reportedErrors.has(err)) return;
		const ext = getExtErrorProps(err);
		if (ext && ext.hide) return;
		if (ext && ext.system) {
			this.error(err.message);
		} else {
			this.error(util.inspect(err));
		}
		this.reportedErrors.add(err);
	}
	targetError(id: string, err: Error) {
		if (this.reportedErrors.has(err)) return;
		const ext = getExtErrorProps(err);
		if (ext && ext.hide) return;
		if (ext && ext.system) {
			this.error(err.message);
		} else {
			this.error(
				`Unhandled exception when building "${id}":\n`,
				chalk.gray(util.inspect(err))
			);
		}
		this.reportedErrors.add(err);
	}
	targetHalt(name: string) {
		this.targetHalts.add(name);
		this.progressMessage();
	}
	targetUnHalt(name: string) {
		this.targetHalts.delete(name);
		this.progressMessage();
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
		return (chalk as any)[color](symbol + (word ? " " + chalk.underline.bold(word) : ""));
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
				if (this.verbosity < 8 && lengthSofar + segText.length >= len) {
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
		if (this.verbosity < 6) return;
		this.rawLog(
			this.directive("blueBright", "♦", ""),
			this.extractFirstLine(commands, this.columns, this.getStyle(style || ""))
		);
	}

	// Directive logging
	private directiveLogging(directive: string, color: string, ...args: any[]) {
		const [prefix, postfix] = color
			? (chalk as any)[color]("<<##BEGIN##>>").split("<<##BEGIN##>>")
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
		if (this.verbosity < 8) return;
		this.directiveLogging(this.directive("gray", "·", "Debug"), "gray", ...line);
	}
	info(...line: any[]) {
		if (this.verbosity < 7) return;
		this.directiveLogging(this.directive("gray", "·", ""), "gray", ...line);
	}
	echo(...line: any[]) {
		if (this.verbosity < 5) return;
		this.directiveLogging("", "", ...line);
	}
	note(...line: any[]) {
		if (this.verbosity < 5) return;
		this.directiveLogging(this.directive("cyan", "●", "Note"), "", ...line);
	}
	warn(...line: any[]) {
		if (this.verbosity < 4) return;
		this.directiveLogging(this.directive("yellow", "!", "Warning"), "", ...line);
	}
	success(...line: any[]) {
		if (this.verbosity < 3) return;
		this.directiveLogging(this.directive("green", "√", "Success"), "", ...line);
	}
	fail(...line: any[]) {
		if (this.verbosity < 3) return;
		this.directiveLogging(this.directive("red", "×", "Fail"), "", ...line);
	}
	error(...line: any[]) {
		if (this.verbosity < 2) return;
		this.directiveLogging(this.directive("red", "×", "Error"), "", ...line);
	}
	fatal(...line: any[]) {
		if (this.verbosity < 1) return;
		this.directiveLogging(this.directive("red", "×", "Fatal"), "", ...line);
	}
}

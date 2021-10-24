import * as Util from "util";
import { HighlightedRun } from "./console-styles";
import { Reporter } from "./index";

export class RedirectReporter implements Reporter {
	public verbosity: number;
	constructor(verbosity: number) {
		this.verbosity = verbosity;
	}
	start() {}
	end(wrong?: boolean) {}

	// Target start/termination
	targetStart(id: string) {
		this.info("Target Start", id);
	}
	targetSkip(id: string) {
		this.info("Target Skipped", id);
	}
	targetEnd(id: string) {
		this.info("Target Finished", id);
	}
	targetHalt(id: string) {}
	targetUnHalt(id: string) {}
	systemError(e: Error) {
		this.error("System Error", e);
	}
	targetError(name: string, e: Error) {
		this.error("Target Error", e);
	}

	// STDOUT/STDERR redirection
	redirectStdout(line: string | Buffer) {
		process.stdout.write(line);
	}
	redirectStderr(line: string | Buffer) {
		process.stderr.write(line);
	}

	// Action logging
	private static unescapeActionTerm(x: any) {
		if (x instanceof HighlightedRun) return String(x.text);
		else return Util.inspect(x);
	}
	actions(lines: any[][], style?: string) {
		if (this.verbosity < 6) return;
		for (const line of lines) {
			console.log("[ACTION]", ...line.map(RedirectReporter.unescapeActionTerm));
		}
	}

	// Levelled logging
	debug(...line: any[]) {
		if (this.verbosity < 8) return;
		console.log("[DEBUG]", ...line);
	}
	info(...line: any[]) {
		if (this.verbosity < 7) return;
		console.log("[INFO]", ...line);
	}
	echo(...line: any[]) {
		if (this.verbosity < 5) return;
		console.log("[ECHO]", ...line);
	}
	note(...line: any[]) {
		if (this.verbosity < 5) return;
		console.log("[NOTE]", ...line);
	}
	warn(...line: any[]) {
		if (this.verbosity < 4) return;
		console.log("[WARNING]", ...line);
	}
	success(...line: any[]) {
		if (this.verbosity < 3) return;
		console.log("[SUCCESS]", ...line);
	}
	fail(...line: any[]) {
		if (this.verbosity < 3) return;
		console.log("[FAIL]", ...line);
	}
	error(...line: any[]) {
		if (this.verbosity < 2) return;
		console.log("[ERROR]", ...line);
	}
	fatal(...line: any[]) {
		if (this.verbosity < 1) return;
		console.log("[FATAL]", ...line);
	}
}

import { Reporter } from "./index";

export class ProxyReporter implements Reporter {
	constructor(private real: () => Reporter) {}

	start() {
		this.real().start();
	}
	end(wrong?: boolean) {
		this.real().end(wrong);
	}
	get verbosity() {
		return this.real().verbosity;
	}

	// Target start/termination
	targetStart(name: string) {
		this.real().targetStart(name);
	}
	targetSkip(name: string) {
		this.real().targetSkip(name);
	}
	targetEnd(name: string) {
		this.real().targetEnd(name);
	}
	targetHalt(name: string) {
		this.real().targetHalt(name);
	}
	targetUnHalt(name: string) {
		this.real().targetUnHalt(name);
	}
	systemError(e: Error) {
		this.real().systemError(e);
	}
	targetError(name: string, e: Error) {
		this.real().targetError(name, e);
	}

	// STDOUT/STDERR redirection
	redirectStdout(line: string | Buffer) {
		this.real().redirectStdout(line);
	}
	redirectStderr(line: string | Buffer) {
		this.real().redirectStderr(line);
	}

	// Action logging
	actions(lines: any[][], style?: string) {
		this.real().actions(lines, style);
	}

	// Levelled logging
	debug(...line: any[]) {
		this.real().debug(...line);
	}
	info(...line: any[]) {
		this.real().info(...line);
	}
	echo(...line: any[]) {
		this.real().echo(...line);
	}
	warn(...line: any[]) {
		this.real().warn(...line);
	}
	note(...line: any[]) {
		this.real().note(...line);
	}
	success(...line: any[]) {
		this.real().success(...line);
	}
	fail(...line: any[]) {
		this.real().fail(...line);
	}
	error(...line: any[]) {
		this.real().error(...line);
	}
	fatal(...line: any[]) {
		this.real().fatal(...line);
	}
}

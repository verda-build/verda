import { Reporter } from "./index";

export class SuppressedReporter implements Reporter {
	constructor(private readonly m_reporter: Reporter) {}

	start() {}
	end(wrong?: boolean) {
		return this.m_reporter.end(wrong);
	}

	// Target start/termination
	targetStart(name: string) {}
	targetSkip(name: string) {}
	targetEnd(name: string) {}
	targetHalt(name: string) {}
	targetUnHalt(name: string) {}
	systemError(e: Error) {
		return this.m_reporter.systemError(e);
	}
	targetError(name: string, e: Error) {
		return this.m_reporter.targetError(name, e);
	}

	// STDOUT/STDERR redirection
	redirectStdout(line: string | Buffer) {
		return this.m_reporter.redirectStdout(line);
	}
	redirectStderr(line: string | Buffer) {
		return this.m_reporter.redirectStderr(line);
	}

	// Action logging
	actions(lines: any[][], style?: string) {}

	// Levelled logging
	debug(...line: any[]) {}
	info(...line: any[]) {}
	echo(...line: any[]) {}
	warn(...line: any[]) {}
	note(...line: any[]) {}
	success(...line: any[]) {}
	fail(...line: any[]) {
		return this.m_reporter.fail(...line);
	}
	error(...line: any[]) {
		return this.m_reporter.error(...line);
	}
	fatal(...line: any[]) {
		return this.m_reporter.fatal(...line);
	}
}

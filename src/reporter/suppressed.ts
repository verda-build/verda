import { Reporter } from "./index";

export class SuppressedReporter implements Reporter {
	constructor(private readonly m_reporter: Reporter) {}

	start() {}
	end(wrong?: boolean) {
		return this.m_reporter.end(wrong);
	}
	get verbosity() {
		return this.m_reporter.verbosity;
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
	actions(lines: any[][], style?: string) {
		if (this.verbosity < 7) return;
		return this.m_reporter.actions(lines, style);
	}

	// Levelled logging
	debug(...line: any[]) {
		if (this.verbosity < 7) return;
		return this.m_reporter.debug(...line);
	}
	info(...line: any[]) {
		if (this.verbosity < 7) return;
		return this.m_reporter.info(...line);
	}
	echo(...line: any[]) {
		if (this.verbosity < 7) return;
		return this.m_reporter.echo(...line);
	}
	warn(...line: any[]) {
		if (this.verbosity < 7) return;
		return this.m_reporter.warn(...line);
	}
	note(...line: any[]) {
		if (this.verbosity < 7) return;
		return this.m_reporter.note(...line);
	}
	success(...line: any[]) {
		if (this.verbosity < 7) return;
		return this.m_reporter.success(...line);
	}
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

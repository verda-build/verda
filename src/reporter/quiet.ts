import { Reporter } from ".";

export class QuietReporter implements Reporter {
	start() {}
	end(wrong?: boolean) {}

	// Target start/termination
	targetStart(name: string) {}
	targetSkip(name: string) {}
	targetEnd(name: string) {}
	targetHalt(name: string) {}
	targetUnHalt(name: string) {}
	systemError(e: Error) {}
	targetError(name: string, e: Error) {}

	// STDOUT/STDERR redirection
	redirectStdout(line: string | Buffer) {}
	redirectStderr(line: string | Buffer) {}

	// Action logging
	actions(lines: any[][], style?: string) {}

	// Levelled logging
	debug(...line: any[]) {}
	info(...line: any[]) {}
	echo(...line: any[]) {}
	warn(...line: any[]) {}
	note(...line: any[]) {}
	success(...line: any[]) {}
	fail(...line: any[]) {}
	error(...line: any[]) {}
	fatal(...line: any[]) {}
}

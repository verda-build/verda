export interface Reporter {
	start(): void;
	end(wrong?: boolean): void;

	// Target start/termination
	targetStart(name: string, kind: string): void;
	targetSkip(name: string, kind: string): void;
	targetEnd(name: string): void;
	targetError(name: string, e: Error): void;

	// STDOUT/STDERR redirection
	redirectStdout(line: string | Buffer): void;
	redirectStderr(line: string | Buffer): void;

	// Action logging
	actions(lines: any[][], style?: string): void;

	// Levelled logging
	debug(...line: any[]): void;
	info(...line: any[]): void;
	echo(...line: any[]): void;
	warn(...line: any[]): void;
	note(...line: any[]): void;
	success(...line: any[]): void;
	fail(...line: any[]): void;
	error(...line: any[]): void;
	fatal(...line: any[]): void;
}

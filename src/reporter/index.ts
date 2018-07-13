export interface Reporter {
	start();
	end(wrong?: boolean);

	// Target start/termination
	targetStart(name: string, kind: string);
	targetSkip(name: string, kind: string);
	targetEnd(name: string);
	targetError(name: string, e: Error);

	// STDOUT/STDERR redirection
	redirectStdout(line: string | Buffer);
	redirectStderr(line: string | Buffer);

	// Action logging
	actions(lines: any[][], style?: string);

	// Levelled logging
	debug(...line: any[]);
	info(...line: any[]);
	echo(...line: any[]);
	warn(...line: any[]);
	note(...line: any[]);
	success(...line: any[]);
	fail(...line: any[]);
	error(...line: any[]);
	fatal(...line: any[]);
}

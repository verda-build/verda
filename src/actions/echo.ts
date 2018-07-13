import { ActionEnv } from "./interfaces";

export interface EchoFunction {
	(...args: any[]): void;
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

export function createKit_Echo(ce: ActionEnv) {
	const echoFn: EchoFunction = Object.assign(
		function(...args: any[]) {
			ce.reporter.echo(...args);
		},
		{
			debug: (...args: any[]) => ce.reporter.debug(...args),
			info: (...args: any[]) => ce.reporter.info(...args),
			warn: (...args: any[]) => ce.reporter.warn(...args),
			echo: (...args: any[]) => ce.reporter.echo(...args),
			note: (...args: any[]) => ce.reporter.note(...args),
			success: (...args: any[]) => ce.reporter.success(...args),
			fail: (...args: any[]) => ce.reporter.fail(...args),
			error: (...args: any[]) => ce.reporter.error(...args),
			fatal: (...args: any[]) => ce.reporter.fatal(...args)
		}
	);
	return {
		echo: echoFn
	};
}

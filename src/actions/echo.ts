import { HighlightedRun } from "../reporter/console-styles";
import { ActionEnv } from "./interfaces";

export interface EchoFunction {
	(...args: any[]): void;
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

export function createKit_Echo(ce: ActionEnv) {
	const echoFn: EchoFunction = Object.assign(
		function (...args: any[]) {
			ce.reporter.echo(...args);
		},
		{
			debug: (...args: any[]) => ce.reporter.debug(...args),
			info: (...args: any[]) => ce.reporter.info(...args),
			warn: (...args: any[]) => ce.reporter.warn(...args),
			echo: (...args: any[]) => ce.reporter.echo(...args),
			note: (...args: any[]) => ce.reporter.note(...args),
			action: (...args: any[]) => ce.reporter.actions([args]),
			success: (...args: any[]) => ce.reporter.success(...args),
			fail: (...args: any[]) => ce.reporter.fail(...args),
			error: (...args: any[]) => ce.reporter.error(...args),
			fatal: (...args: any[]) => ce.reporter.fatal(...args),
			hl: {
				directive: (s: unknown) => new HighlightedRun("directive", s),
				operator: (s: unknown) => new HighlightedRun("operator", s),
				command: (s: unknown) => new HighlightedRun("command", s),
				param: (s: unknown) => new HighlightedRun("param", s),
				quote: (s: unknown) => new HighlightedRun("quote", s),
				numeric: (s: unknown) => new HighlightedRun("numeric", s),
			},
		}
	);
	return {
		echo: echoFn,
	};
}

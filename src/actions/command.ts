import { ChildProcess, spawn } from "child_process";
import * as which from "which";

import { SleepPromise } from "../core/director";
import { Reporter } from "../reporter";

import { ActionEnv, DeepArray } from "./interfaces";
import { nextTick } from "process";

export function flattenArgList(args: DeepArray<any>): string[] {
	let ans: string[] = [];
	for (let x of args) {
		if (x === undefined || x === null) {
			continue;
		} else if (Array.isArray(x)) {
			ans = [...ans, ...flattenArgList(x)];
		} else {
			ans.push(x + "");
		}
	}
	return ans;
}

export interface ProcessActionOptions {
	cwd: string;
	interactive?: boolean;
	env: any;
	reporter: Reporter;
}

export interface ProcessExitStatus {
	code?: number;
	signal?: string;
}

function startPipeline(
	commands: string[][],
	options: ProcessActionOptions
): Promise<ProcessExitStatus> {
	let processes: ChildProcess[] = [];
	if (options.reporter) {
		options.reporter.actions(commands, "command");
	}
	for (let j = commands.length - 1; j >= 0; j--) {
		const [cmd, ...args] = commands[j];
		const realCommand = which.sync(cmd);
		const p = spawn(realCommand, args, {
			cwd: options.cwd,
			env: options.env,
			stdio: options.interactive ? "inherit" : "pipe",
		});

		if (options.reporter && !options.interactive) {
			p.stderr!.on("data", (data) => options.reporter.redirectStderr(data));
			if (j < commands.length - 1) {
				const next = processes[j + 1];
				p.stdout!.on("data", (data) => next.stdin!.write(data));
				p.on("close", () => next.stdin!.end());
			} else {
				p.stdout!.on("data", (data) => options.reporter.redirectStdout(data));
			}
		}
		processes[j] = p;
	}
	return new Promise(function (resolve, reject) {
		for (let j = 0; j < processes.length; j++) {
			processes[j].on("exit", function (code, signal) {
				if (signal) reject({ signal });
				else if (code) reject({ code });
				else if (j === processes.length - 1) resolve({ code: 0 });
			});
		}
	});
}

export class ProcessPipePromise implements PromiseLike<ProcessExitStatus> {
	private pendingCommands: string[][] = [];
	private p: Promise<ProcessExitStatus>;
	constructor(options: ProcessActionOptions) {
		this.p = SleepPromise(0).then(() => startPipeline(this.pendingCommands, options));
	}
	pipe(...commandLine: any[]) {
		this.pendingCommands.push(flattenArgList(commandLine));
		return this;
	}
	then<TResult1, TResult2 = never>(
		onfulfilled?:
			| ((value: ProcessExitStatus) => TResult1 | PromiseLike<TResult1>)
			| undefined
			| null,
		onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
	): PromiseLike<TResult1 | TResult2> {
		return this.p.then(onfulfilled, onrejected);
	}
}

export function createKit_Command(ce: ActionEnv) {
	function startCommand(
		commandLine: DeepArray<any>,
		options: ProcessActionOptions
	): ProcessPipePromise {
		return new ProcessPipePromise(options).pipe(...commandLine);
	}

	function runCommand(...commandLine: any[]) {
		return startCommand(commandLine, { cwd: ce.cd, env: ce.env, reporter: ce.reporter });
	}
	function runInteractive(...commandLine: any[]) {
		return startCommand(commandLine, {
			cwd: ce.cd,
			env: ce.env,
			reporter: ce.reporter,
			interactive: true,
		});
	}

	return {
		run: runCommand,
		interactive: runInteractive,
	};
}

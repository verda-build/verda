import * as cp from "child_process";
import * as path from "path";
import { Worker } from "worker_threads";

import { IpcMessage } from "../../ipc";
import { ProcessActionOptions } from "../command";
import { ActionEnv } from "../interfaces";

function nodejsExitPromise(p: cp.ChildProcess, returnValue: () => any, err: () => any) {
	return new Promise<any>(function (resolve, reject) {
		p.on("exit", function (code, signal) {
			const e = err();
			const r = returnValue();
			if (signal || code || e) {
				return reject(e);
			} else {
				return resolve(r);
			}
		});
	});
}

function nodejsWorkerExitPromise(w: Worker, returnValue: () => any, err: () => any) {
	return new Promise<any>(function (resolve, reject) {
		w.on("exit", function (code) {
			const e = err();
			const r = returnValue();
			if (code || e) {
				return reject(e || new Error("Worker thread exited with code " + code));
			} else {
				return resolve(r);
			}
		});
	});
}

function startNodeJSCallPromise(
	module: string,
	modulePath: string,
	args: any[],
	options: ProcessActionOptions
) {
	let returnValue: string | null = null;
	let errorThrown: Error | null = null;
	let proc = cp.spawn(
		process.execPath,
		[path.join(__dirname, "nodejs-call-process.js")],
		{
			cwd: options.cwd,
			env: options.env,
			stdio: ["pipe", "pipe", "pipe", "ipc"],
		}
	);

	if (options.reporter) {
		options.reporter.actions([[module, ...args]], "jsCall");
	}

	proc.on("message", function (message: IpcMessage) {
		if (!message.directive) {
			errorThrown = new Error("IPC Error " + message);
		}
		switch (message.directive) {
			case "ready":
				proc.send({ directive: "load", path: modulePath });
				break;
			case "loaded":
				proc.send({ directive: "call", args: args });
				break;
			case "return":
				returnValue = message.result;
				proc.send({ directive: "over" });
				break;
			case "error":
				errorThrown = new Error(message.reason);
				break;
			case "callError":
				errorThrown = new Error(message.message || message.reason);
				break;
			default:
				errorThrown = new Error("<IPC Error> " + message);
				break;
		}
	});

	if (options.reporter) {
		if (proc.stdout) proc.stdout.on("data", (data) => options.reporter.redirectStdout(data));
		if (proc.stderr) proc.stderr.on("data", (data) => options.reporter.redirectStderr(data));
	}

	return nodejsExitPromise(
		proc,
		() => returnValue,
		() => errorThrown
	);
}

function startNodeJSWorkerThreadPromise(
	module: string,
	modulePath: string,
	args: any[],
	options: ProcessActionOptions
) {
	let returnValue: string | null = null;
	let errorThrown: Error | null = null;
	let worker = new Worker(path.join(__dirname, "nodejs-call-worker.js"), {
		env: options.env,
		stdout: !!options.reporter,
		stderr: !!options.reporter,
	});

	if (options.reporter) {
		options.reporter.actions([[module, ...args]], "jsCall");
	}

	worker.on("message", function (message: IpcMessage) {
		if (!message.directive) {
			errorThrown = new Error("IPC Error " + message);
		}
		switch (message.directive) {
			case "ready":
				worker.postMessage({ directive: "load", path: modulePath });
				break;
			case "loaded":
				worker.postMessage({ directive: "call", args: args });
				break;
			case "return":
				returnValue = message.result;
				worker.postMessage({ directive: "over" });
				break;
			case "error":
				errorThrown = new Error(message.reason);
				break;
			case "callError":
				errorThrown = new Error(message.message || message.reason);
				break;
			default:
				errorThrown = new Error("<IPC Error> " + message);
				break;
		}
	});

	worker.on("error", function (error) {
		errorThrown = error;
	});

	if (options.reporter) {
		if (worker.stdout) worker.stdout.on("data", (data) => options.reporter.redirectStdout(data));
		if (worker.stderr) worker.stderr.on("data", (data) => options.reporter.redirectStderr(data));
	}

	return nodejsWorkerExitPromise(
		worker,
		() => returnValue,
		() => errorThrown
	);
}

export function createKit_NodeJS(ce: ActionEnv) {
	function runNodeJS(module: string, ...args: any[]): Promise<any> {
		return startNodeJSCallPromise(module, path.resolve(ce.cd, module), args, {
			cwd: ce.cd,
			env: ce.env,
			reporter: ce.reporter,
		});
	}

	runNodeJS.worker = function (module: string, ...args: any[]) {
		return startNodeJSWorkerThreadPromise(module, path.resolve(ce.cd, module), args, {
			cwd: ce.cd,
			env: ce.env,
			reporter: ce.reporter,
		});
	};

	return {
		node: runNodeJS,
	};
}

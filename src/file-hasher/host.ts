import * as cp from "child_process";
import { ChildProcess } from "child_process";
import * as crypto from "crypto";
import * as fs from "fs-extra";
import * as os from "os";
import * as path from "path";
import Semaphore from "semaphore-async-await";

const jobs = os.cpus().length;
const semaphore = new Semaphore(jobs);

function nodejsExitPromise(p: ChildProcess, returnValue: () => any, err: () => any) {
	return new Promise<any>(function(resolve, reject) {
		p.on("exit", function(code, signal) {
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

function hashFileChildProcessImpl(fileName: string): Promise<string> {
	let returnValue: string | null = null;
	let errorThrown: Error | null = null;
	let proc = cp.spawn(process.execPath, [path.join(__dirname, "guest.js")], {
		stdio: ["pipe", "pipe", "pipe", "ipc"]
	});

	proc.on("message", function(message) {
		if (!message.directive) {
			errorThrown = new Error("IPC Error " + message);
		}
		switch (message.directive) {
			case "ready":
				proc.send({ directive: "compute", path: fileName });
				break;
			case "return":
				returnValue = message.result;
				proc.send({ directive: "over" });
				break;
			case "error":
				console.error("<IPC Error>", message.reason);
				errorThrown = new Error(message.reason);
				break;
			case "callError":
				console.error("<Failure>", message.message || message.reason);
				errorThrown = new Error(message.message || message.reason);
				break;
			default:
				errorThrown = new Error("<IPC Error> " + message);
				break;
		}
	});

	return nodejsExitPromise(proc, () => returnValue, () => errorThrown);
}

export async function hashFile(path: string) {
	try {
		await semaphore.acquire();
		const h = await hashFileChildProcessImpl(path);
		semaphore.release();
		return h;
	} catch (e) {
		semaphore.release();
		throw e;
	}
}

export async function hashSmallFile(path: string): Promise<string> {
	return new Promise((resolve, reject) => {
		let sum = crypto.createHash("sha1");

		let fileStream = fs.createReadStream(path);
		fileStream.on("error", function(err) {
			return reject(err);
		});
		fileStream.on("data", function(chunk) {
			try {
				sum.update(chunk);
			} catch (ex) {
				return reject(ex);
			}
		});
		fileStream.on("end", function() {
			return resolve(sum.digest("hex"));
		});
	});
}

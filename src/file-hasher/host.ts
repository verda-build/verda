import * as crypto from "crypto";
import * as fs from "fs-extra";
import * as os from "os";
import * as path from "path";
import Semaphore from "semaphore-async-await";
import { Worker } from "worker_threads";
import { IpcMessage } from "../ipc";

const jobs = os.cpus().length;
const semaphore = new Semaphore(jobs);

function nodejsExitPromise(p: Worker, returnValue: () => any, err: () => any) {
	return new Promise<any>(function (resolve, reject) {
		p.on("exit", function () {
			const e = err();
			const r = returnValue();
			if (e) {
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

	const thread = new Worker(path.join(__dirname, "thread.js"), { stdout: true });
	thread.on("message", function (message: IpcMessage) {
		if (!message.directive) {
			errorThrown = new Error("IPC Error " + message);
		}
		switch (message.directive) {
			case "ready":
				thread.postMessage({ directive: "compute", path: fileName });
				break;
			case "return":
				returnValue = message.result;
				thread.unref();
				break;
			default:
				errorThrown = new Error("<IPC Error> " + message);
				break;
		}
	});
	thread.on("error", function (e) {
		errorThrown = e;
	});

	return nodejsExitPromise(
		thread,
		() => returnValue,
		() => errorThrown
	);
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
		fileStream.on("error", function (err) {
			return reject(err);
		});
		fileStream.on("data", function (chunk) {
			try {
				sum.update(chunk);
			} catch (ex) {
				return reject(ex);
			}
		});
		fileStream.on("end", function () {
			return resolve(sum.digest("hex"));
		});
	});
}

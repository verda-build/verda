import * as crypto from "crypto";
import * as fs from "fs-extra";
import * as os from "os";
import * as path from "path";
import Semaphore from "semaphore-async-await";
import { Worker } from "worker_threads";
import { IpcMessage } from "../ipc";

const jobs = os.cpus().length;
const semaphore = new Semaphore(jobs);

class ThreadExit<T> {
	public constructor(
		private readonly thread: Worker,
		private readonly fnResolve: (x: T) => void,
		private readonly fnReject: (x: unknown) => void
	) {}
	private exited = false;
	public resolve(x: T) {
		if (!this.exited) {
			this.thread.unref();
			this.exited = true;
			setImmediate(() => this.fnResolve(x));
		}
	}
	public reject(x: unknown) {
		if (!this.exited) {
			this.thread.unref();
			this.exited = true;
			setImmediate(() => this.fnReject(x));
		}
	}
}

function hashFileChildProcessImpl(fileName: string): Promise<string> {
	return new Promise<string>((resolve, reject) => {
		const thread = new Worker(path.join(__dirname, "thread.js"), { stdout: true });
		const exit = new ThreadExit<string>(thread, resolve, reject);
		thread.on("message", (message: IpcMessage) => {
			if (!message.directive) {
				exit.reject(new Error("IPC Error: " + message));
				return;
			}
			switch (message.directive) {
				case "ready":
					thread.postMessage({ directive: "compute", path: fileName });
					return;
				case "return":
					exit.resolve(message.result);
					return;
				default:
					exit.reject(new Error("IPC Error: " + message));
					return;
			}
		});
		thread.on("error", (e) => exit.reject(e));
	});
}
export async function hashFile(path: string) {
	await semaphore.acquire();
	try {
		return await hashFileChildProcessImpl(path);
	} finally {
		semaphore.release();
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

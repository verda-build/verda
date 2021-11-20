import * as crypto from "crypto";
import * as fs from "fs-extra";
import * as os from "os";
import * as path from "path";
import Semaphore from "semaphore-async-await";
import { Worker } from "worker_threads";
import { IpcMessage } from "../ipc";

const jobs = os.cpus().length;
const semaphore = new Semaphore(jobs);

class ThreadFileHasher<T> {
	private thread: null | Worker;
	public constructor(
		fileName: string,
		thread: Worker,
		private readonly fnResolve: (x: T) => void,
		private readonly fnReject: (x: unknown) => void
	) {
		this.thread = thread;
		thread.on("message", (message: IpcMessage) => {
			if (!message.directive) {
				this.reject(new Error("IPC Error: " + message));
				return;
			}
			switch (message.directive) {
				case "ready":
					thread.postMessage({ directive: "compute", path: fileName });
					return;
				case "return":
					this.resolve(message.result);
					return;
				default:
					this.reject(new Error("IPC Error: " + message));
					return;
			}
		});
		thread.on("error", (e) => this.reject(e));
	}

	private resolve(x: T) {
		if (this.thread) {
			this.thread.unref();
			this.thread = null;
			setImmediate(() => this.fnResolve(x));
		}
	}
	private reject(x: unknown) {
		if (this.thread) {
			this.thread.unref();
			this.thread = null;
			setImmediate(() => this.fnReject(x));
		}
	}
}

function hashFileChildProcessImpl(fileName: string): Promise<string> {
	return new Promise<string>((resolve, reject) => {
		new ThreadFileHasher<string>(
			fileName,
			new Worker(path.join(__dirname, "thread.js"), { stdout: true }),
			resolve,
			reject
		);
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

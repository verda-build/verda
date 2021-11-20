import * as crypto from "crypto";
import * as fs from "fs-extra";
import { parentPort } from "worker_threads";

if (!parentPort) {
	throw new Error("This script only works in worker threads.");
}

function hashFile(path: string): Promise<string> {
	return new Promise((resolve, reject) => {
		let sum = crypto.createHash("sha1");

		let fileStream = fs.createReadStream(path);
		fileStream.on("error", (err) => {
			return reject(err);
		});
		fileStream.on("data", (chunk) => {
			try {
				sum.update(chunk);
			} catch (ex) {
				return reject(ex);
			}
		});
		fileStream.on("end", () => {
			return resolve(sum.digest("hex"));
		});
	});
}

parentPort.on("message", (message: any) => {
	switch (message.directive) {
		case "compute":
			if (!message.path) {
				parentPort!.unref();
				throw new Error("Path not found.");
			}

			hashFile(message.path)
				.then((result) => {
					parentPort!.postMessage({ directive: "return", result });
					parentPort!.unref();
				})
				.catch((e) => {
					parentPort!.unref();
					throw e;
				});

			break;
		default:
			parentPort!.unref();
			throw new Error("Message directive not recognized.");
	}
});

setTimeout(() => parentPort!.postMessage({ directive: "ready" }), 0);

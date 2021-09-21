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

parentPort.on("message", function (message: any) {
	console.log("thread recieved", message);
	switch (message.directive) {
		case "compute":
			if (!message.path) {
				throw new Error("Path not found.");
			}

			hashFile(message.path)
				.then((result) => {
					console.log("hash complete:", result);
					parentPort!.postMessage({ directive: "return", result });
					parentPort!.unref();
				})
				.catch((e) => {
					throw e;
				});

			break;
		default:
			throw new Error("Message directive not recognized.");
			break;
	}
});

setTimeout(() => parentPort!.postMessage({ directive: "ready" }), 0);

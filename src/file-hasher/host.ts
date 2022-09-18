import * as crypto from "crypto";
import * as fs from "fs-extra";
import * as path from "path";

import Piscina from "piscina";

const threadHasherPool = new Piscina({ filename: path.resolve(__dirname, "worker.js") });

export async function hashFile(path: string) {
	return await threadHasherPool.run(path);
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

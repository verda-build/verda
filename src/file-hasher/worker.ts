import * as crypto from "crypto";
import * as fs from "fs-extra";

module.exports = function hashFile(path: string): Promise<string> {
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
};

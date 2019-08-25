import * as crypto from "crypto";
import * as fs from "fs-extra";
import * as util from "util";

if (!process.send) {
	throw new Error("process.send! not defined");
}

function hashFile(path: string): Promise<string> {
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

process.on("message", function(message) {
	if (!message.directive) {
		process.send!({ directive: "error", reason: "Message directive not found." });
		process.exit(1);
	}

	switch (message.directive) {
		case "compute":
			if (!message.path) {
				process.send!({ directive: "error", reason: "path not found." });
				process.exit(1);
				return;
			}

			hashFile(message.path)
				.then(result => process.send!({ directive: "return", result }))
				.catch(e => {
					process.send!({ directive: "callError", reason: e, message: util.inspect(e) });
					process.exit(1);
				});

			break;
		case "over":
			process.exit(0);
			break;
		default:
			process.send!({ directive: "error", reason: "Message directive not recognized." });
			break;
	}
});

setTimeout(() => process.send!({ directive: "ready" }), 0);

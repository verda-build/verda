import * as util from "util";
import * as url from "url";
import { parentPort } from "worker_threads";

let state: { fn: Function | null; ret: any } = { fn: null, ret: null };

if (!parentPort) {
	throw new Error("parentPort not defined");
}

const port = parentPort;

port.on("message", function (message: any) {
	if (!message.directive) {
		port.postMessage({ directive: "error", reason: "Message directive not found." });
		process.exit(1);
	}
	switch (message.directive) {
		case "load":
			import(url.pathToFileURL(message.path).toString())
				.then((module) => {
					state.fn = findBuildFn(module);
					port.postMessage({ directive: "loaded" });
				})
				.catch((e) => {
					port.postMessage({ directive: "callError", reason: e, message: util.inspect(e) });
					process.exit(1);
				});
			break;
		case "call":
			if (!state.fn) {
				port.postMessage({ directive: "error", reason: "Function not loaded." });
				process.exit(1);
			}
			let ret = null;
			try {
				ret = state.fn!.apply(null, message.args);
			} catch (e) {
				port.postMessage({ directive: "callError", reason: e, message: util.inspect(e) });
				process.exit(1);
			}
			if (ret instanceof Promise) {
				ret.then((result) => port.postMessage({ directive: "return", result })).catch((e) => {
					port.postMessage({ directive: "callError", reason: e, message: util.inspect(e) });
					process.exit(1);
				});
			} else {
				port.postMessage({ directive: "return", result: ret });
			}
			break;
		case "over":
			process.exit(0);
			break;
		default:
			port.postMessage({ directive: "error", reason: "Message directive not recognized." });
			break;
	}
});

function findBuildFn(m: any) {
	if (m.build && m.build instanceof Function) return m.build;
	if (m.default && m.default instanceof Function) return m.default;
	if (m instanceof Function) return m;
}

setTimeout(() => port.postMessage({ directive: "ready" }), 0);

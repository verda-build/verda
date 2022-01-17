import * as util from "util";
let state: { fn: Function | null; ret: any } = { fn: null, ret: null };
if (!process.send) {
	throw new Error("process.send! not defined");
}
process.on("message", function (message: any) {
	if (!message.directive) {
		process.send!({ directive: "error", reason: "Message directive not found." });
		process.exit(1);
	}
	switch (message.directive) {
		case "load":
			import(message.path)
				.then((module) => {
					state.fn = findBuildFn(module);
					process.send!({ directive: "loaded" });
				})
				.catch((e) => {
					process.send!({ directive: "callError", reason: e, message: util.inspect(e) });
					process.exit(1);
				});
			break;
		case "call":
			if (!state.fn) {
				process.send!({ directive: "error", reason: "Function not loaded." });
				process.exit(1);
			}
			let ret = null;
			try {
				ret = state.fn!.apply(null, message.args);
			} catch (e) {
				process.send!({ directive: "callError", reason: e, message: util.inspect(e) });
				process.exit(1);
			}
			if (ret instanceof Promise) {
				ret.then((result) => process.send!({ directive: "return", result })).catch((e) => {
					process.send!({ directive: "callError", reason: e, message: util.inspect(e) });
					process.exit(1);
				});
			} else {
				process.send!({ directive: "return", result: ret });
			}
			break;
		case "over":
			process.exit(0);
			break;
		default:
			process.send!({ directive: "error", reason: "Message directive not recognized." });
			break;
	}
});

function findBuildFn(m: any) {
	if (m.build && m.build instanceof Function) return m.build;
	if (m.default && m.default instanceof Function) return m.default;
	if (m instanceof Function) return m;
}

setTimeout(() => process.send!({ directive: "ready" }), 0);

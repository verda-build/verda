import { Runner } from "./cli/runner";
import { VerdaConfig, IExternalOptions } from "./edsl/config";
import { Arguments } from "yargs";

export function createEnv(rulePath?: string, cwd?: string, argv?: Arguments) {
	const config = new VerdaConfig(<IExternalOptions>Object.assign({ rulePath, cwd }, argv || {}));
	const runner = new Runner(config);
	return { runner, config, argv, ...runner.getSandbox() };
}

let env = createEnv();

export function setEnv(rulePath: string, cwd: string, argv: Arguments) {
	env = createEnv(rulePath, cwd, argv);
}

export function getEnv() {
	return env;
}

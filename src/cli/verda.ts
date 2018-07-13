import * as yargs from "yargs";
import posixifyPath from "../match/posixify-path";
import { searchConfig } from "./search-config";
import * as de from "../default-env";

const argv = yargs.argv;

const { cwd, config: rulePath } = searchConfig(argv.r, argv.f, "verdafile.js");

process.chdir(cwd);
process.once("SIGINT", () => process.exit(1)).once("SIGTERM", () => process.exit(1));

main(rulePath).catch(e => {
	process.exit(1);
});

// The main building process
async function main(rulePath: string) {
	de.setEnv(rulePath, cwd, argv);
	const verda = await import("..");

	// Import the rule
	const m = await import(rulePath);

	if (m instanceof Function) {
		const r = m();
		if (r instanceof Promise) await r;
	}

	const start = verda.runner.setStartTask("meta:start");
	const selfTracking = verda.runner.setSelfTracking(
		"meta:self-tracking",
		`file-updated:${posixifyPath(rulePath)}`
	);

	await verda.runner.loadJournal();
	try {
		await verda.runner.build(start, selfTracking);
	} finally {
		try {
			await verda.runner.saveJournal();
		} catch (e) {}
	}
}

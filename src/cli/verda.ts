import * as yargs from "yargs";
import posixifyPath from "../match/posixify-path";
import { searchConfig } from "./search-config";
import * as path from "path";

const argv = yargs.argv;
let suppressOutput = false;
const { cwd, config: rulePath } = searchConfig(argv.r, argv.f, "verdafile.js");

process.chdir(cwd);
process.once("SIGINT", () => process.exit(1)).once("SIGTERM", () => process.exit(1));

main(rulePath).catch(e => {
	if (!suppressOutput) console.error(e);
	process.exit(1);
});

// The main building process
async function main(rulePath: string) {
	// We resolve DE and Verda Instance's path by relative to rule file's
	// It would fix some rare case of casing bugs.
	const rulePathDir = path.dirname(rulePath);
	const relativeDefaultEnvPath = path.relative(
		rulePathDir,
		path.resolve(__dirname, "../default-env.js")
	);
	const relativeVerdaPath = path.relative(rulePathDir, path.resolve(__dirname, "../index.js"));
	const absoluteDefaultEnvPath = path.join(rulePathDir, relativeDefaultEnvPath);
	const absoluteVerdaPath = path.join(rulePathDir, relativeVerdaPath);

	const de = await import(absoluteDefaultEnvPath);
	de.setEnv(rulePath, cwd, argv);
	const verda = await import(absoluteVerdaPath);

	// Import the rule
	const m = await import(rulePath);

	if (m instanceof Function) {
		const r = m(verda, argv, cwd, rulePath);
		if (r instanceof Promise) await r;
	}

	const start = verda.runner.setStartTask("meta:start");
	const selfTracking = verda.runner.setSelfTracking(
		"meta:self-tracking",
		`file-updated:${posixifyPath(rulePath)}`
	);

	await verda.runner.loadJournal();
	try {
		suppressOutput = true;
		await verda.runner.build(start, selfTracking);
		suppressOutput = false;
	} finally {
		await verda.runner.saveJournal();
	}
}

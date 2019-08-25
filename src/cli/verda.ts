import * as yargs from "yargs";

import { Session } from "../session";

import { searchConfig } from "./search-config";

const argv = yargs.argv;
const { cwd, config: rulePath } = searchConfig(argv.r, argv.f, "verdafile.js");

process.chdir(cwd);
process.once("SIGINT", () => process.exit(1)).once("SIGTERM", () => process.exit(1));

main(rulePath).catch(e => {
	console.error("");
	console.error(e);
	process.exit(1);
});

// The main building process
async function main(rulePath: string) {
	const _sessionModule = await import(rulePath);
	const _session = _sessionModule.default || _sessionModule;

	if (!_session.loadJournal || !_session.start) {
		throw new Error(`Configuration ${rulePath} is not default-exporting a Verda configuration`);
	}

	const session = _session as Session;
	session.bindConfig({ rulePath, cwd, ...argv });

	await session.loadJournal();
	await session.createSelfTrackingRule(session.userSelfTrackingGoal);
	try {
		await session.start(...argv._);
	} finally {
		await session.saveJournal();
	}
}

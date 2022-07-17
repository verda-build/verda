import * as yargs from "yargs";

import { getExtErrorProps } from "../errors";
import { Session } from "../session";
import * as url from "url";

import { searchConfig } from "./search-config";

const argv = yargs.argv;

main().catch((e) => {
	const ext = getExtErrorProps(e);
	if (!ext) {
		console.error("");
		console.error(e);
	}
	process.exit(1);
});

// The main building process
async function main() {
	const { cwd, config: rulePath } = await searchConfig(argv as any, [
		"verdafile.js",
		"verdafile.cjs",
		"verdafile.mjs",
	]);
	process.chdir(cwd);

	const _sessionModule = await import(url.pathToFileURL(rulePath).toString());
	const _session = _sessionModule.build || _sessionModule.default || _sessionModule;

	if (!_session.loadJournal || !_session.start) {
		throw new Error(`Configuration ${rulePath} is not default-exporting a Verda configuration`);
	}

	const session = _session as Session;
	session.bindConfig({ rulePath, cwd, ...argv });

	await session.loadJournal();
	await session.createSelfTrackingRule(session.userSelfTrackingGoal);

	const userCancel = () => {
		session.userCancelSync();
		process.exit(1);
	};
	process.once("SIGINT", userCancel).once("SIGTERM", userCancel);

	try {
		await session.start(...(argv as any)._);
	} finally {
		session.saveJournalSync();
	}
}

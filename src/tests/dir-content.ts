import test from "ava";
import * as fs from "fs-extra";

import { VerdaConfig } from "../config";
import Director from "../core/director";
import { ImplicitFileRules } from "../rule-types/file";
import { Task } from "../rule-types/task";
import { tamper, wait } from "../test-helper";

test("Dir content test", async t => {
	const director = new Director();
	const { dc } = ImplicitFileRules(new VerdaConfig({ rulePath: "./package.json" }), director);
	const { task } = Task(director);

	let triggeredRebuild = false;

	const start = task(`start`, async t => {
		await t.need(dc`payloads/dir-content/some-test`);
		triggeredRebuild = true;
	});

	async function rebuild() {
		triggeredRebuild = false;
		await wait(100);
		await director.reset();
		await director.want(start);
	}

	await fs.ensureDir("payloads/dir-content/some-test");
	await tamper("payloads/dir-content/some-test/a.txt", "");

	await rebuild();
	t.is(triggeredRebuild, true);
	await rebuild();
	t.is(triggeredRebuild, false);

	// Changing file content will not trigger rebuild -- because start depends on
	// the structure of payload dir only
	// File recreated, should trigger rebuild
	await tamper("payloads/dir-content/some-test/a.txt", "a");
	await rebuild();
	t.is(triggeredRebuild, true);

	// Only content change, no rebuild
	await tamper("payloads/dir-content/some-test/a.txt", "b");
	await rebuild();
	t.is(triggeredRebuild, false);

	// Remove file, should trigger rebuild
	await tamper("payloads/dir-content/some-test/a.txt", "");
	await rebuild();
	t.is(triggeredRebuild, true);

	await tamper("payloads/dir-content/some-test/a.txt", "");
	await rebuild();
	t.is(triggeredRebuild, false);
});

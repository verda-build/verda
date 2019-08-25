import test from "ava";
import * as fs from "fs-extra";

import { VerdaConfig } from "../config";
import Director from "../core/director";
import { ImplicitFileRules } from "../rule-types/file";
import { Task } from "../rule-types/task";
import { tamper, wait } from "../test-helper";

test("Dynamic dependency test", async t => {
	const director = new Director();
	const { dc, fu } = ImplicitFileRules(new VerdaConfig({ rulePath: "./package.json" }), director);
	const { task } = Task(director);

	let triggeredRebuild = false;

	const start = task(`start`, async target => {
		const list = "payloads/dynamic/list.txt";
		await target.need(fu`payloads/dynamic/list.txt`);
		const lines = (await fs.readFile(list, "utf-8"))
			.split("\n")
			.map(file => fu`payloads/dynamic/${file}`);
		await target.need(...lines);
		triggeredRebuild = true;
	});

	async function rebuild() {
		triggeredRebuild = false;
		await wait(100);
		await director.reset();
		await director.want(start);
	}

	await fs.ensureDir("payloads/dynamic");
	await tamper("payloads/dynamic/list.txt", "a.txt\nb.txt");
	await tamper("payloads/dynamic/a.txt", "a");
	await tamper("payloads/dynamic/b.txt", "b");
	await tamper("payloads/dynamic/c.txt", "c");

	await rebuild();
	t.is(triggeredRebuild, true);
	await rebuild();
	t.is(triggeredRebuild, false);

	// Adding new dependency
	await tamper("payloads/dynamic/list.txt", "a.txt\nb.txt\nc.txt");
	await rebuild();
	t.is(triggeredRebuild, true);

	// Tampering without changing should not trigger rebuild
	await tamper("payloads/dynamic/c.txt", "c");
	await rebuild();
	t.is(triggeredRebuild, false);

	// Removing dependency
	await tamper("payloads/dynamic/list.txt", "a.txt\nb.txt");
	await rebuild();
	t.is(triggeredRebuild, true);

	// Tamper a non-dep
	await tamper("payloads/dynamic/c.txt", "c");
	await rebuild();
	t.is(triggeredRebuild, false);

	// Remove a non-dep
	await tamper("payloads/dynamic/c.txt", "");
	await rebuild();
	t.is(triggeredRebuild, false);

	// Tamper a dep
	await tamper("payloads/dynamic/a.txt", "aa");
	await rebuild();
	t.is(triggeredRebuild, true);

	// Tamper a dep without changes
	await tamper("payloads/dynamic/a.txt", "aa");
	await rebuild();
	t.is(triggeredRebuild, false);
});

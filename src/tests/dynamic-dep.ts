import test from "ava";
import * as fs from "fs-extra";
import { createSandbox } from "../edsl";
import { Bddy2Config } from "../edsl/config";
import { tamper, wait } from "../test-helper";

const {
	resolver,
	rule: { task }
} = createSandbox(new Bddy2Config());

task("start").def(async target => {
	const list = "payloads/dynamic/list.txt";
	const r = await target.need("payloads/dynamic/list.txt");
	const lines = (await fs.readFile(list, "utf-8"))
		.split("\n")
		.map(file => `payloads/dynamic/${file}`);
	const deps = await target.need(...lines);
	triggeredRebuild = true;
});

let triggeredRebuild = false;
async function rebuild() {
	triggeredRebuild = false;
	await wait(100);
	await resolver.want(resolver.query("start"));
}

test("Dynamic dependency", async t => {
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

	// Remove a depended file
	// Should throw an error
	await tamper("payloads/dynamic/c.txt", "");
	await t.throws(rebuild(), Error);

	// Bring it back
	// Should trigger rebuild
	await tamper("payloads/dynamic/c.txt", "c");
	await rebuild();
	t.is(triggeredRebuild, true);

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
	await tamper("payloads/dynamic/a.txt", "a");
	await rebuild();
	t.is(triggeredRebuild, true);
});

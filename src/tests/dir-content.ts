import test from "ava";
import * as fs from "fs-extra";
import { createSandbox } from "../edsl";
import { Bddy2Config } from "../edsl/config";
import { tamper, wait } from "../test-helper";
import { resolve } from "url";

const {
	resolver,
	rule: { task }
} = createSandbox(new Bddy2Config());

task("start").def(async target => {
	await target.need("payloads/dir-content/some-test");
	triggeredRebuild = true;
});

let triggeredRebuild = false;
async function rebuild() {
	triggeredRebuild = false;
	await wait(100);
	await resolver.want(resolver.query("start"));
}

test("Directory contents", async t => {
	await fs.ensureDir("payloads/dir-content/some-test");
	await tamper("payloads/dir-content/some-test/a.txt", "");

	await rebuild();
	t.is(triggeredRebuild, true);
	await rebuild();
	t.is(triggeredRebuild, false);

	await tamper("payloads/dir-content/some-test/a.txt", "a");
	await rebuild();
	t.is(triggeredRebuild, true);

	await tamper("payloads/dir-content/some-test/a.txt", "b");
	await rebuild();
	t.is(triggeredRebuild, false);

	await tamper("payloads/dir-content/some-test/a.txt", "");
	await rebuild();
	t.is(triggeredRebuild, true);

	await tamper("payloads/dir-content/some-test/a.txt", "");
	await rebuild();
	t.is(triggeredRebuild, false);
});

import test from "ava";
import { wait, tamper } from "../test-helper";
import * as fs from "fs-extra";
import { createSandbox } from "../edsl";
import { Bddy2Config } from "../edsl/config";

const {
	resolver,
	rule: { task, variable },
	macro: { FileListUpdated }
} = createSandbox(new Bddy2Config());

// BEGIN BUILD SCRIPT
const dir1 = `payloads/self-tracking-1`;
const dir2 = `payloads/self-tracking-2`;
variable("dir1-changed").def(FileListUpdated({ under: dir1 }));
variable("dir2-changed").def(FileListUpdated({ under: dir2 }));
task("start").def(async target => {
	await target.need("dir1-changed");
	triggeredRebuild = true;
});
task("meta:self-tracking").def(async target => {
	await target.need("dir2-changed");
});
// END BUILD SCRIPT

let triggeredRebuild = false;
async function rebuild() {
	triggeredRebuild = false;
	await wait(1000);
	await resolver.want(resolver.query("start"));
	await resolver.want(resolver.query("meta:self-tracking"));
	resolver.setImplicitDependency("user", resolver.query("meta:self-tracking"));
}

test("Nested file dependency", async t => {
	await fs.emptyDir(dir1);
	await fs.ensureDir(`${dir1}/nest`);
	await tamper(`${dir1}/a.txt`, "a");
	await tamper(`${dir1}/nest/a.txt`, "a");

	await fs.emptyDir(dir2);
	await tamper(`${dir2}/rule.txt`, "a");

	await rebuild();
	t.is(triggeredRebuild, true);

	await tamper(`${dir2}/rule.txt`, "a");
	await rebuild();
	t.is(triggeredRebuild, true);
});

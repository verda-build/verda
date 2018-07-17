import test from "ava";
import { wait, tamper } from "../test-helper";
import * as fs from "fs-extra";
import { createSandbox } from "../edsl";
import { VerdaConfig } from "../edsl/config";

const {
	resolver,
	rule: { task, oracle },
	macro: { FileListUpdated }
} = createSandbox(new VerdaConfig({}));

// BEGIN BUILD SCRIPT
const dir = `payloads/nested`;
oracle("content-updated").def(FileListUpdated({ under: dir, pattern: "**/*.txt" }));
task("start").def(async target => {
	await target.need("content-updated");
	triggeredRebuild = true;
});
// END BUILD SCRIPT

let triggeredRebuild = false;
async function rebuild() {
	triggeredRebuild = false;
	await wait(1000);
	await resolver.want(resolver.query("start"));
}

test("Nested file dependency", async t => {
	await fs.emptyDir(dir);
	await fs.ensureDir(`${dir}/nest`);
	await tamper(`${dir}/a.txt`, "a");
	await tamper(`${dir}/nest/a.txt`, "a");

	await rebuild();
	t.is(triggeredRebuild, true);

	await tamper(`${dir}/nest/a.txt`, "a");
	await rebuild();
	t.is(triggeredRebuild, true);

	await tamper(`${dir}/nest/b.txt`, "b");
	await rebuild();
	t.is(triggeredRebuild, true);

	await tamper(`${dir}/nest/b.txt`, "");
	await rebuild();
	t.is(triggeredRebuild, true);

	await fs.ensureDir(`${dir}/nest2`);
	await rebuild();
	t.is(triggeredRebuild, false);
	await rebuild();
	t.is(triggeredRebuild, false);

	await tamper(`${dir}/nest2/f.txt`, "f");
	await rebuild();
	t.is(triggeredRebuild, true);
	await rebuild();
	t.is(triggeredRebuild, false);

	await fs.remove(`${dir}/nest2`);
	await rebuild();
	t.is(triggeredRebuild, true);
});

import test from "ava";
import { createSandbox } from "../edsl";
import { Bddy2Config } from "../edsl/config";
import { wait } from "../test-helper";

const {
	resolver,
	rule: { task, oracle }
} = createSandbox(new Bddy2Config());

task("start").def(async target => {
	await target.need("b", "c");
	await target.need("b1", "c1");
});
task("b").def(async target => {
	await target.need("d");
});
task("c").def(async target => {
	await target.need("d");
});
task("d").def(async target => {
	target.is.volatile();
	triggeredRebuild++;
});

task("b1").def(async target => {
	await target.need("d1");
});
task("c1").def(async target => {
	await target.need("d1");
});
task("d1").def(async target => {
	await target.need("d2");
	triggeredRebuild++;
});
oracle("d2").def(async () => 1);

let triggeredRebuild = 0;
async function rebuild() {
	triggeredRebuild = 0;
	await wait(100);
	await resolver.want(resolver.query("start"));
}

test("Diamond dependency", async t => {
	await rebuild();
	t.is(triggeredRebuild, 2);

	// Only target <d> is volatile
	await rebuild();
	t.is(triggeredRebuild, 1);
});

import test from "ava";

import { Oracle } from "../../rule-types/oracle";
import { Task } from "../../rule-types/task";
import Director from "../director";

test("Basic diamond", async t => {
	const director = new Director();
	const { oracle } = Oracle(director);

	const a = oracle("a", async t => 1);
	const b = oracle("b", async t => {
		await t.need(a);
		return 2;
	});
	const c = oracle("c", async t => {
		await t.need(a);
		return 3;
	});
	const d = oracle("d", async t => {
		await t.need(b, c);
		return 4;
	});

	const [dResult] = await director.want(d);
	t.is(dResult, 4);
});

test("Diamond cutoff", async t => {
	const director = new Director();
	const { oracle, computed } = Oracle(director);
	const { task } = Task(director);

	let a1value = 1;
	let a2value = 1;
	let bBuildTimes = 0;
	let cBuildTimes = 0;
	let dBuildTimes = 0;

	const a1 = oracle("a1", async t => a1value);
	const a2 = oracle("a2", async t => a2value);
	const b = oracle("b", async t => {
		bBuildTimes++;
		await t.need(a1);
		return 2;
	});
	const c = oracle("c", async t => {
		cBuildTimes++;
		await t.need(a2);
		return 3;
	});
	const d = task("d", async t => {
		dBuildTimes++;
		await t.need(b, c);
		return 4;
	});

	const [dResult] = await director.want(d);
	t.is(dResult, 4);
	t.is(bBuildTimes, 1);
	t.is(cBuildTimes, 1);
	t.is(dBuildTimes, 1);

	a1value = 2;
	director.reset();

	const [dResult2] = await director.want(d);
	t.is(dResult2, 4);
	t.is(bBuildTimes, 2);
	t.is(cBuildTimes, 2);
	t.is(dBuildTimes, 1);
});

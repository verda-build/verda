import test from "ava";

import { KindMatcherT, MakeMatcher } from "../matchers";

test("String pattern matcher test", t => {
	const stm = new MakeMatcher((a, b, c) => `${a}/${b}/${c}`);
	t.is(stm.createGoalIdFromArgs(["a", "b", "c"]).id, "a/b/c");
	t.is(stm.matchGoalID("a/b/c", ["a", "b", "c"])!.id, "a/b/c");
	t.is(stm.matchGoalID("a/b/d", ["a", "b", "c"]), null);
});

test("Prefix matcher test", t => {
	const stm = new KindMatcherT("Prefix::", new MakeMatcher((a, b, c) => `${a}/${b}/${c}`));
	t.is(stm.createGoalIdFromArgs(["a", "b", "c"]).id, "Prefix::a/b/c");
	t.is(stm.matchGoalID("Prefix::a/b/c", ["a", "b", "c"])!.id, "Prefix::a/b/c");
	t.is(stm.matchGoalID("Prefix::a/b/d", ["a", "b", "c"]), null);
	t.is(stm.matchGoalID("a/b/c", ["a", "b", "c"]), null);
	t.is(stm.matchGoalID("a/b/d", ["a", "b", "c"]), null);
});

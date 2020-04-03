import { VerdaConfig } from "../config";
import { Dependency, GoalMatcher, RuleMatchResult } from "../core/interface";
import { NonPosixifyPatternMatch } from "../match";
import { ParsedPath } from "../match/interface";
import ParsedPathImpl from "../match/parse-path";

export class AlwaysMatcher implements GoalMatcher<[string]> {
	constructor() {}
	private createName(args: string[]) {
		if (args.length !== 1) throw new TypeError(`AlwaysMatcher: args should be 1 item.`);
		return args[0];
	}

	createGoalIdFromArgs(args: string[]) {
		const arg = this.createName(args);
		return {
			id: this.createName([arg]),
			args: [arg],
			execArgs: [arg] as [string]
		};
	}
	matchString(name: string) {
		return this.createGoalIdFromArgs([name]);
	}
	matchGoalID(id: string, args: string[]) {
		if (args.length !== 1) return null;
		return this.createGoalIdFromArgs(args);
	}
}

export class ExactMatcher implements GoalMatcher<[]> {
	constructor(private readonly name: string) {}
	createGoalIdFromArgs(args: string[]) {
		return { id: this.name, args: [], execArgs: [] as [] };
	}
	matchString(name: string) {
		if (name === this.name) {
			return this.createGoalIdFromArgs([]);
		} else {
			return null;
		}
	}
	matchGoalID(id: string, args: string[]) {
		if (this.name === id && args.length === 0) {
			return this.createGoalIdFromArgs([]);
		} else {
			return null;
		}
	}
}

export class GlobMatcher implements GoalMatcher<string[]> {
	private readonly matchFunction: (s: string) => null | string[];
	constructor(private readonly pattern: string) {
		this.matchFunction = NonPosixifyPatternMatch(pattern);
	}
	private createGoalIdFromArgsImpl(args: string[], pm: string[]) {
		const arg = args[0];
		return { id: arg, args, execArgs: pm };
	}
	createGoalIdFromArgs(args: string[]) {
		const arg = args[0];
		const pm = this.matchFunction(arg);
		if (!pm) throw new Error(`Cannot match ${arg} with ${this.pattern} when creating goal.`);
		return this.createGoalIdFromArgsImpl(args, pm);
	}
	matchString(name: string) {
		const pm = this.matchFunction(name);
		if (!pm) return null;
		else return this.createGoalIdFromArgsImpl([name], pm);
	}
	matchGoalID(id: string, args: string[]) {
		if (args.length !== 1) return null;
		const arg = args[0];
		const pm = this.matchFunction(arg);
		if (!pm || id !== arg) return null;
		return this.createGoalIdFromArgsImpl(args, pm);
	}
}

export class MakeMatcher<K extends string[]> implements GoalMatcher<string[]> {
	constructor(private readonly nameMaker: (...args: K) => string) {}
	createGoalIdFromArgs(args: string[]) {
		if (args.length !== this.nameMaker.length) {
			throw new TypeError(`MakeMaker args length mismatch`);
		}
		const id = this.nameMaker(...(args as K));
		return { id, args, execArgs: args };
	}
	matchString() {
		return null;
	}
	matchGoalID(id: string, args: string[]) {
		if (args.length !== this.nameMaker.length) return null;
		const expected = this.createGoalIdFromArgs(args);
		if (expected.id === id) return expected;
		else return null;
	}
}

export class KindMatcherT<A> implements GoalMatcher<A> {
	constructor(private readonly prefix: string, private readonly inner: GoalMatcher<A>) {}
	createGoalIdFromArgs(args: string[]) {
		const ex = this.inner.createGoalIdFromArgs(args);
		return this.wrap(ex);
	}
	private wrap(ex: Dependency & { execArgs: A }) {
		return { ...ex, id: this.prefix + ex.id };
	}
	private wrapNullable(ex: RuleMatchResult<A>) {
		if (ex) return this.wrap(ex);
		else return null;
	}
	matchString(name: string) {
		return this.wrapNullable(this.inner.matchString(name));
	}
	matchGoalID(id: string, args: string[]) {
		if (!id.startsWith(this.prefix)) return null;
		return this.wrapNullable(this.inner.matchGoalID(id.slice(this.prefix.length), args));
	}
}

export class PrefixMatcherT<A> implements GoalMatcher<A> {
	constructor(private readonly prefix: string, private readonly inner: GoalMatcher<A>) {}
	createGoalIdFromArgs(args: string[]) {
		const ex = this.inner.createGoalIdFromArgs(args);
		return this.wrap(ex);
	}
	private wrap(ex: Dependency & { execArgs: A }) {
		return { ...ex, id: this.prefix + ex.id };
	}
	private wrapNullable(ex: RuleMatchResult<A>) {
		if (ex) return this.wrap(ex);
		else return null;
	}
	matchString(name: string) {
		if (!name.startsWith(this.prefix)) return null;
		return this.wrapNullable(this.inner.matchString(name.slice(this.prefix.length)));
	}
	matchGoalID(id: string, args: string[]) {
		if (!id.startsWith(this.prefix)) return null;
		return this.wrapNullable(this.inner.matchGoalID(id.slice(this.prefix.length), args));
	}
}

export class NoStringMatcherT<A> implements GoalMatcher<A> {
	constructor(private readonly inner: GoalMatcher<A>) {}
	createGoalIdFromArgs(args: string[]) {
		return this.inner.createGoalIdFromArgs(args);
	}
	matchString(name: string) {
		return null;
	}
	matchGoalID(id: string, args: string[]) {
		return this.inner.matchGoalID(id, args);
	}
}

export type FileExecArgs = [ParsedPath, ...string[]];
export class FilePathMatcherT implements GoalMatcher<FileExecArgs> {
	constructor(private readonly cfg: VerdaConfig, private readonly inner: GoalMatcher<string[]>) {}
	createGoalIdFromArgs(args: string[]) {
		const ex = this.inner.createGoalIdFromArgs(args);
		return this.wrap(ex);
	}
	private wrap(ex: Dependency & { execArgs: string[] }) {
		const pp = new ParsedPathImpl(ex.id, ex.execArgs);
		return { ...ex, execArgs: [pp, ...ex.execArgs] as FileExecArgs };
	}
	private wrapNullable(ex: RuleMatchResult<string[]>) {
		if (ex) return this.wrap(ex);
		else return null;
	}

	matchString(name: string) {
		return this.wrapNullable(this.inner.matchString(name));
	}
	matchGoalID(id: string, args: string[]) {
		return this.wrapNullable(this.inner.matchGoalID(id, args));
	}
}

import BuildResolver from "../engine/resolver";
import { MatchFunction, Rule } from "../engine/rule";
import { Bddy2Config } from "./config";
import { File } from "./rule/file";
import { Phony } from "./rule/phony";
import { Task } from "./rule/task";
import { Variable } from "./rule/variable";
import { FileList, FileListUpdated } from "./execs/file-list";

function RuleStub<T extends Rule>(
	resolver: BuildResolver,
	ctor: new (kind: string, pattern: string | MatchFunction) => T
): (pattern: string | MatchFunction) => T {
	return function(pattern) {
		const rule = new ctor("user", pattern);
		resolver.defineRule(rule);
		return rule;
	};
}

// Rule definition and resolution bindings
export function createResolverBindings(resolver: BuildResolver, config: Bddy2Config) {
	return {
		want(...targets: string[]) {
			for (const target of targets) config.objectives.push(target);
		},
		journal(path: string) {
			config.journal = path;
		},
		baseDir(path: string) {
			config.cd = path;
		},

		// Rule directives
		rule: {
			task: RuleStub(resolver, Task),
			file: RuleStub(resolver, File),
			oracle: RuleStub(resolver, Variable),
			phony: RuleStub(resolver, Phony)
		},

		// Predefined Execs
		macro: {
			FileList,
			FileListUpdated
		}
	};
}

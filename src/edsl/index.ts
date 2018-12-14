import { ActionEnv } from "../actions/interfaces";
import { Rule } from "../engine/rule";
import BuildResolver from "../engine/resolver";
import { VerdaConfig } from "./config";
import {
	ActionEnvKitFunction,
	ActionKitFunction,
	defaultActionEnvKit,
	defaultActionKit
} from "./edsl-actions";
import { createResolverBindings } from "./edsl-directives";
import {
	dirExists,
	dirStructure,
	fileExists,
	fileUpdated,
	fileUpdatedExplicit
} from "./predefined-rules";

const predefinedRules: Rule[] = [
	fileUpdated,
	fileUpdatedExplicit,
	dirStructure,
	fileExists,
	dirExists
];

export function createSandbox(config: VerdaConfig) {
	const resolver = new BuildResolver();
	for (const rule of predefinedRules) resolver.defineRule(rule);
	const actionKits: ActionKitFunction[] = [defaultActionKit];
	const actionEnvKits: ActionEnvKitFunction[] = [defaultActionEnvKit];

	function getCmd(ce: ActionEnv, config: VerdaConfig) {
		let o: any = {};
		for (const k of actionKits) {
			o = Object.assign(o, k(ce, config));
		}
		for (const k of actionEnvKits) {
			const kit = k(ce, config);
			for (const key in kit) {
				const fn = kit[key];
				o[key] = (argument: any) => getCmd(fn(argument), config);
			}
		}
		return o;
	}

	return {
		resolver,
		...createResolverBindings(resolver, config),
		action: getCmd(config, config),
		loadKit(k: ActionKitFunction) {
			actionKits.push(k);
			return k(config, config);
		},
		loadEnvKit(k: ActionEnvKitFunction) {
			actionEnvKits.push(k);
			return k(config, config);
		}
	};
}

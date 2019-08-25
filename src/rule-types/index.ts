import { VerdaConfig } from "../config";
import Director from "../core/director";
import { BindFileList } from "../predefined-functions/file-list";

import { File, ImplicitFileRules } from "./file";
import { Oracle } from "./oracle";
import { Phony } from "./phony";
import { SelfTracking } from "./self-tracking";
import { Task } from "./task";

export function bindDefaultRuleTypes(cfg: VerdaConfig, dir: Director) {
	return {
		...Oracle(dir),
		...File(cfg, dir),
		...Task(dir),
		...Phony(dir),
		SelfTracking: SelfTracking(dir)
	};
}

export function bindDefaultRulesAndFunctions(cfg: VerdaConfig, dir: Director) {
	const implF = ImplicitFileRules(cfg, dir);
	const FileList = BindFileList(implF.ds);

	return {
		rules: {
			...implF
		},
		predefinedFuncs: {
			FileList
		}
	};
}

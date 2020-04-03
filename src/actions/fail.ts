import { ActionEnv } from "./interfaces";
import { createExtError } from "../errors";

export function createKit_Fail(ce: ActionEnv) {
	return {
		fail: function(...args: any[]): never {
			ce.reporter.fail(...args);
			throw createExtError(new Error(args.join(" ")), { hide: true });
		}
	};
}

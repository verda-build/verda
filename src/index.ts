import { Session } from "./session";
import { ISession } from "./session/interface";

export function create(): ISession {
	return new Session();
}

// Type exports
export * from "./core/interface";
export * from "./session/interface";
export * from "./match/interface";
export * from "./rule-types/interface";

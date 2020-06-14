export type IpcMessage =
	| ReadyMessage
	| LoadedMessage
	| ReturnMessage
	| ErrorMessage
	| CallErrorMessage;

export type ReadyMessage = { directive: "ready" };
export type LoadedMessage = { directive: "loaded" };
export type ReturnMessage = { directive: "return"; result: any };
export type ErrorMessage = { directive: "error"; reason: string };
export type CallErrorMessage = { directive: "callError"; message?: string; reason: string };

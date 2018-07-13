import { ArgList } from "../../engine/interfaces";

export function Collects(...args: ArgList<string>) {
	return async target => {
		return await target.need(...args);
	};
}

import { ArgList, ITargetExec } from "../../engine/interfaces";

export function Collects(...args: ArgList<string>) {
	return async (target: ITargetExec) => {
		return await target.need(...args);
	};
}

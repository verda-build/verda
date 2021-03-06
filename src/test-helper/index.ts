import * as fs from "fs-extra";

export function wait(dt: number) {
	return new Promise<null>(resolve => {
		setTimeout(() => resolve(null), dt);
	});
}

export async function tamper(p: string, r: string) {
	await wait(2000);
	if (!r) await fs.remove(p);
	else await fs.writeFile(p, r);
}

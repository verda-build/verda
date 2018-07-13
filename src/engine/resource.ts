import Semaphore from "semaphore-async-await";

export interface ResourceLock {
	getLock(): Promise<void>;
	releaseLock(): Promise<void>;
	exec<T>(fn: () => Promise<T>): Promise<T>;
}

function wait(dt: number) {
	return new Promise(resolve => {
		setTimeout(() => resolve(null), dt);
	});
}

export class Resource implements ResourceLock {
	// Locking
	constructor(n: number = 0) {
		this.setParallel(n);
	}
	lock: Semaphore = null;
	setParallel(n: number) {
		if (!n) this.lock = null;
		else this.lock = new Semaphore(n);
	}
	async getLock() {
		if (this.lock) {
			await wait(0);
			await this.lock.acquire();
		} else {
			await wait(0);
		}
	}
	async releaseLock() {
		if (this.lock) {
			this.lock.release();
		}
		await wait(0);
	}
	exec<T>(fn: () => Promise<T>): Promise<T> {
		return this.getLock()
			.then(fn)
			.then(es => this.releaseLock().then(() => Promise.resolve(es)))
			.catch(e => this.releaseLock().then(() => Promise.reject(e)));
	}
}

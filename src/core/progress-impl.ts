import { createExtError } from "../errors";
import {
	Arbitrator,
	BuildStatus,
	Dependency,
	PreBuildResult,
	PreBuildStatus,
	Progress,
} from "./interface";

type AcceptHandler<T> = (result: T) => void;
type ModifiedHandler = (yes: PreBuildResult) => void;
type RejectHandler = (e: Error) => void;
type BoundRecipe<T> = () => Promise<T>;

export default class ProgressImpl<T> implements Progress<T> {
	readonly id: string;
	isUser: boolean = true;
	lastResult: undefined | T = undefined;
	result: undefined | T = undefined;
	status: BuildStatus = BuildStatus.NOT_STARTED;
	preBuildStatus: PreBuildStatus = PreBuildStatus.UNKNOWN;
	preBuildResult: PreBuildResult = PreBuildResult.YES;
	dependencies: Dependency[][] = [];
	volatile: boolean = true;

	revision: number = 0;
	private _lastError: Error | null = null;

	private listeners: AcceptHandler<T>[] = [];
	private errorListeners: RejectHandler[] = [];
	private modifiedListeners: ModifiedHandler[] = [];

	constructor(id: string) {
		this.id = id;
	}

	resetBuildStatus() {
		this.status = BuildStatus.NOT_STARTED;
		this.preBuildStatus = PreBuildStatus.UNKNOWN;
		this.listeners = [];
		this.errorListeners = [];
		this.modifiedListeners = [];
	}

	// Building method set
	start(arb: Arbitrator, fn: BoundRecipe<T>) {
		if (this.status === BuildStatus.NOT_STARTED) {
			this.status = BuildStatus.STARTED;

			// We clear dependencies list to track dependency updates
			this.volatile = false;
			this.dependencies = [];
			this.lastResult = this.result;
			this.result = undefined;

			// Do it
			arb.start(this)
				.then(fn)
				.then((x) => this.finish(arb, x))
				.catch((e) => this.error(arb, e));
		}
		return this.finishPromise();
	}

	async halt(arb: Arbitrator) {
		if (this.status !== BuildStatus.STARTED) return;
		this.status = BuildStatus.HALT;
		await arb.halt(this);
	}

	async unhalt(arb: Arbitrator) {
		if (this.status !== BuildStatus.HALT) return;
		this.status = BuildStatus.STARTED;
		await arb.unhalt(this);
	}

	private async finish(arb: Arbitrator, ret: T) {
		await arb.end(this, null);
		this.status = BuildStatus.FINISHED;
		this.result = ret;
		const listeners = [...this.listeners];
		for (const e of listeners) setTimeout(() => e(ret), 0);
	}

	private async error(arb: Arbitrator, reason: Error) {
		await arb.end(this, reason);
		this.status = BuildStatus.ERROR;
		this._lastError = reason;
		this.volatile = true;
		const listeners = [...this.errorListeners];
		for (const e of listeners) setTimeout(() => e(reason), 0);
	}

	finishPromise(): Promise<any> {
		if (this.status === BuildStatus.FINISHED) {
			return Promise.resolve(this.result);
		} else if (this.status === BuildStatus.ERROR) {
			return Promise.reject(this._lastError);
		} else {
			return new Promise<any>((resolve, reject) => {
				this.listeners.push(resolve);
				this.errorListeners.push(reject);
			});
		}
	}

	// Skip checking method set
	startModifiedCheck(fn: () => Promise<PreBuildResult>) {
		if (this.preBuildStatus === PreBuildStatus.UNKNOWN) {
			this.preBuildStatus = PreBuildStatus.CHECKING;
			fn()
				.then((x) => this.finishModifiedCheck(x))
				.catch((e) => this.finishModifiedCheck(PreBuildResult.YES));
		}
		return this.modifiedCheckFinishPromise();
	}

	async finishModifiedCheck(_yes: PreBuildResult) {
		if (this.preBuildStatus !== PreBuildStatus.DECIDED) {
			this.preBuildStatus = PreBuildStatus.DECIDED;
			this.preBuildResult = _yes;
		}
		for (const e of this.modifiedListeners) setTimeout(() => e(this.preBuildResult), 0);
	}

	modifiedCheckFinishPromise() {
		if (this.preBuildStatus === PreBuildStatus.DECIDED) {
			return Promise.resolve(this.preBuildResult);
		} else {
			return new Promise<PreBuildResult>((resolve, reject) => {
				this.modifiedListeners.push(resolve);
			});
		}
	}

	// JSON import and export
	toJson() {
		const o: any = {
			id: this.id,
			volatile:
				(this.status !== BuildStatus.NOT_STARTED && this.status !== BuildStatus.FINISHED) ||
				this.volatile,
			result: this.result,
			dependencies: this.dependencies.map((t) => [...t]),
			revision: this.revision,
		};
		return o;
	}
	fromJson(j: any) {
		this.volatile = j.volatile;
		this.lastResult = this.result = j.result;
		this.dependencies = j.dependencies;
		this.revision = j.revision || 0;
	}
}

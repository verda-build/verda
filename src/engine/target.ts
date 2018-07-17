import { BuildStatus, ITargetInfo, ModifiedCheckStatus, IResolver } from "./interfaces";
import { BoundRule } from "./rule";

type AcceptHandler = (result: any) => void;
type BooleanHandler = (yes: boolean) => void;
type RejectHandler = (e: Error) => void;

export default class Target implements ITargetInfo {
	id: string = "";
	builtKind: string = "";

	status: BuildStatus = BuildStatus.NOT_STARTED;
	modified: ModifiedCheckStatus = ModifiedCheckStatus.UNKNOWN;

	private _updatedManuallySet: boolean = false;
	updated: Date = new Date(1444, 11, 11, 0, 0, 0, 0);
	dependencies: Set<Target>[] = [];
	implicitDependencies: Set<Target> = new Set();

	private listeners: (AcceptHandler)[] = [];
	private errorListeners: (RejectHandler)[] = [];
	private modifiedListeners: (BooleanHandler)[] = [];

	volatile: boolean = true;

	private _tracked: any = null;
	private _returned: any = undefined;
	private _lastError: Error = null;

	constructor(id) {
		this.id = id;
	}

	toString() {
		return this.id;
	}
	get lastReturned(): any {
		return this._returned;
	}
	get lastError(): Error {
		return this._lastError;
	}

	get tracking(): any {
		return this._tracked;
	}
	track<T>(x: T) {
		this._tracked = x;
		return x;
	}

	setUpdated(date: Date) {
		this._updatedManuallySet = true;
		this.updated = date;
	}

	resetBuildStatus() {
		this.status = BuildStatus.NOT_STARTED;
		this.modified = ModifiedCheckStatus.UNKNOWN;
		this.listeners = [];
		this.errorListeners = [];
		this.modifiedListeners = [];
	}

	// Building method set
	start(kind: string, fn: BoundRule) {
		this.builtKind = kind;
		if (this.status === BuildStatus.NOT_STARTED) {
			this.status = BuildStatus.STARTED;

			// We clear dependencies list to track dependency updates
			this.volatile = false;
			this.implicitDependencies = new Set();
			this.dependencies = [];
			this._returned = undefined;
			this._updatedManuallySet = false;

			// Do it
			fn()
				.then(x => this.finish(x))
				.catch(e => this.error(e));
		}
		return this.finishPromise();
	}

	async finish(ret: any) {
		this.status = BuildStatus.FINISHED;
		if (!this._updatedManuallySet) this.updated = new Date();
		this._returned = ret;
		const listeners = [...this.listeners];
		for (const e of listeners) setTimeout(() => e(ret), 0);
	}

	async error(reason: Error) {
		this.status = BuildStatus.ERROR;
		if (!this._updatedManuallySet) this.updated = new Date();
		this._lastError = reason;
		this.volatile = true;
		const listeners = [...this.errorListeners];
		for (const e of listeners) setTimeout(() => e(reason), 0);
	}

	finishPromise(): Promise<any> {
		if (this.status === BuildStatus.FINISHED) {
			return Promise.resolve(this._returned);
		} else if (this.status === BuildStatus.ERROR) {
			return Promise.reject(this.lastError);
		} else {
			return new Promise<any>((resolve, reject) => {
				this.listeners.push(resolve);
				this.errorListeners.push(reject);
			});
		}
	}

	// Skip checking method set
	startModifiedCheck(fn: () => Promise<boolean>) {
		if (this.modified === ModifiedCheckStatus.UNKNOWN) {
			this.modified = ModifiedCheckStatus.CHECKING;
			fn()
				.then(x => this.finishModifiedCheck(x))
				.catch(e => this.finishModifiedCheck(true));
		}
		return this.modifiedCheckFinishPromise();
	}

	async finishModifiedCheck(_yes: boolean) {
		const yes = _yes || this.modified === ModifiedCheckStatus.YES;
		this.modified = yes ? ModifiedCheckStatus.YES : ModifiedCheckStatus.NO;
		for (const e of this.modifiedListeners) setTimeout(() => e(yes), 0);
	}

	private modifiedCheckFinishPromise() {
		if (this.modified === ModifiedCheckStatus.YES) return Promise.resolve(true);
		else if (this.modified === ModifiedCheckStatus.NO) return Promise.resolve(false);
		else {
			return new Promise<boolean>((resolve, reject) => {
				this.modifiedListeners.push(resolve);
			});
		}
	}

	// JSON import and export
	toJson() {
		const o = {
			id: this.id,
			builtKind: this.builtKind,
			volatile: this.volatile,
			tracking: this._tracked,
			dependencies: this.dependencies.map(t => [...t].map(x => x.id)),
			implicitDependencies: [...this.implicitDependencies].map(x => x.id),
			updated: this.updated.toISOString(),
			lastReturnedSameTrack: false,
			lastReturned: null
		};
		if (this._returned === this._tracked) {
			o.lastReturnedSameTrack = true;
		} else {
			o.lastReturned = this._returned;
		}
		return o;
	}
	fromJson(j, resolver: IResolver<Target>) {
		this.builtKind = j.builtKind;
		this.volatile = j.volatile;
		this._tracked = j.tracking;
		if (j.lastReturnedSameTrack) {
			this._returned = this._tracked;
		} else {
			this._returned = j.lastReturned;
		}
		this.dependencies = j.dependencies.map(
			g => new Set(g.map(targetID => resolver.query(targetID)))
		);
		this.implicitDependencies = new Set(j.implicitDependencies.map(id => resolver.query(id)));
		this.updated = new Date(j.updated);
	}
}

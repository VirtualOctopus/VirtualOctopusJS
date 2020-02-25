import { Store } from ".";
import { ResourceProcessStatus } from "../models";


export class MemoryStore extends Store {

    constructor() {
        super();
        this._store = new Map();
    }

    private _store: Map<string, ResourceProcessStatus>;

    async save(uri: string, status: ResourceProcessStatus): Promise<void> {
        this._store.set(uri, status);
    }

    async status(uri: string): Promise<ResourceProcessStatus> {
        if (this._store.has(uri)) {
            return this._store.get(uri);
        } else {
            return null;
        }
    }

    async query(status: ResourceProcessStatus, maxCount = Number.MAX_SAFE_INTEGER): Promise<string[]> {
        let rt = [];
        for (const entry of this._store) {
            if (entry[1] == status) { rt = rt.concat(entry[0]); }
            if (rt.length >= maxCount) { break; }
        }
        return rt;
    }

    async release(): Promise<void> {
        this._store.clear();
        delete this._store;
    }

}
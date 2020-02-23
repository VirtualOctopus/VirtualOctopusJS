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

    async query(status: ResourceProcessStatus): Promise<string[]> {
        let rt = [];
        this._store.forEach((s, u) => {
            if (s == status) {
                rt = rt.concat(u);
            }
        });
        return rt;
    }

    async release(): Promise<void> {
        this._store.clear();
        delete this._store;
    }

}
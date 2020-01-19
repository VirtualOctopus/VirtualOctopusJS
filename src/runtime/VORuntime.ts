import { createConnection, Connection } from "typeorm";
import { RuntimeModels } from './models/index';

type VORuntimeReadyCallback = (runtime?: VORuntime, error?: Error) => void;

export class VORuntime {

    constructor(cb?: VORuntimeReadyCallback) {
        createConnection({
            name: "runtime",
            type: "sqlite",
            database: "runtime.db",
            synchronize: true,
            entities: RuntimeModels
        }).then(conn => {
            this.conn = conn;
            this._run();
            try {
                if (cb) {
                    cb(this, undefined);
                }
            } finally {
                // nothing
            }

        }).catch(err => {
            if (cb) {
                cb(undefined, err);
            }
        });
    }


    private conn: Connection;

    /**
     * run application
     */
    private _run(): void {
        // 
    }

    /**
     * destroy
     */
    public async destroy(): Promise<void> {
        if (this.conn.isConnected) {
            return await this.conn.close();
        }
    }

}
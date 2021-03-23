// @ts-nocheck
import mysql, { PoolOptions, Pool } from "mysql2/promise";
import { Store } from ".";
import { ResourceProcessStatus } from "../models";

export interface MySQLStoreOptions {
    sync?: boolean;
    tableName?: string;
}

const DefaultMySQLStoreOptions: MySQLStoreOptions = {
    sync: true,
    tableName: "vo_resource",
};

/**
 * MySQLStore for resource
 */
class MySQLStore extends Store {

    constructor(pool: Pool, tableName: string = DefaultMySQLStoreOptions.tableName) {
        super();
        this._pool = pool;
        this._tableName = tableName;
    }

    private _tableName: string;
    private _pool: Pool

    protected async _SyncTable(): Promise<void> {
        await this._pool.query(`create table if not exists ${this._tableName} (uri varchar(1024) not null, status varchar(20) not null);`);
    }

    async save(uri: string, status: ResourceProcessStatus): Promise<void> {

        const s1 = await this.status(uri);
        if (s1) {
            // update
            await this._pool.query(`update ${this._tableName} set status = ? where uri = ?;`, [status, uri]);
        } else {
            // insert
            await this._pool.query(`insert into ${this._tableName} (uri,status) values (?,?);`, [uri, status, status]);
        }
    }

    async status(uri: string): Promise<ResourceProcessStatus> {
        const [results] = await this._pool.query(`select status from ${this._tableName} where uri = ?;`, [uri]);

        if (results.length > 0) {

            const { status } = results[0];
            return status as ResourceProcessStatus;
        } else {
            return null;
        }

    }

    async query(status: ResourceProcessStatus, maxCount?: number): Promise<string[]> {
        let results = [];
        if (maxCount) {
            results = (await this._pool.query(`select uri from ${this._tableName} where status = ? limit ?`, [status, maxCount]))[0];
        } else {
            results = (await this._pool.query(`select uri from ${this._tableName} where status = ?`, [status]))[0];
        }

        const uris = results.map(row => row.uri);
        return uris;
    }

    async release(): Promise<void> {
        await this._pool.end();
    }

}

/**
 * create a mysql resource store
 * 
 * so that resource metadata could be shared in different VORuntime
 * @param options 
 * @param storeOptions 
 */
export const createMySQLStore = async (options?: PoolOptions, storeOptions?: MySQLStoreOptions) => {

    const dOpts = Object.assign(DefaultMySQLStoreOptions, storeOptions);
    const pool = mysql.createPool(options);

    const store = new MySQLStore(pool, dOpts.tableName);

    if (dOpts.sync) {
        await store._SyncTable();
    }

    return store;
};

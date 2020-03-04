/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/ban-ts-ignore */
import mysql, { PoolOptions, Pool } from "mysql2/promise";
import { Store } from ".";
import { ResourceProcessStatus } from "../models";

export interface MySQLStoreOptions extends PoolOptions {
    sync?: boolean;
    tableName?: string;
}

const DefaultMySQLStoreOptions: MySQLStoreOptions = {
    sync: true,
    tableName: "vo_resource",
};

class MySQLStore extends Store {

    constructor(pool: Pool, tableName: string = DefaultMySQLStoreOptions.tableName) {
        super();
        this._pool = pool;
        this._tableName = tableName;
    }

    private _tableName: string;
    private _pool: Pool

    protected async _SyncTable(): Promise<void> {
        const conn = await this._pool.getConnection();
        await conn.query(`create table if not exists ${this._tableName} (uri varchar(1024) not null, status varchar(20) not null);`);
        conn.release();
    }

    async save(uri: string, status: ResourceProcessStatus): Promise<void> {
        const conn = await this._pool.getConnection();
        const s1 = await this.status(uri);
        if (s1) {
            // update
            await conn.query(`update ${this._tableName} set status = ? where uri = ?;`, [status, uri]);
        } else {
            // insert
            await conn.query(`insert into ${this._tableName} (uri,status) values (?,?);`, [uri, status, status]);
        }
        conn.release();
    }

    async status(uri: string): Promise<ResourceProcessStatus> {
        const conn = await this._pool.getConnection();
        const [results] = await conn.query(`select status from ${this._tableName} where uri = ?;`, [uri]);
        // @ts-ignore
        if (results.length > 0) {
            // @ts-ignore
            const { status } = results[0];
            conn.release();
            return status as ResourceProcessStatus;
        } else {
            conn.release();
            return null;
        }

    }

    async query(status: ResourceProcessStatus, maxCount?: number): Promise<string[]> {
        const conn = await this._pool.getConnection();
        let results = [];
        if (maxCount) {
            // @ts-ignore
            results = (await conn.query(`select uri from ${this._tableName} where status = ? limit ?`, [status, maxCount]))[0];
        } else {
            // @ts-ignore
            results = (await conn.query(`select uri from ${this._tableName} where status = ?`, [status]))[0];
        }
        // @ts-ignore
        const uris = results.map(row => row.uri);
        conn.release();
        return uris;
    }

    async release(): Promise<void> {
        await this._pool.end();
    }

}

export const createMySQLStore = async (options?: MySQLStoreOptions) => {
    const dOpts = Object.assign(DefaultMySQLStoreOptions, options);
    const pool = mysql.createPool(dOpts);
    const store = new MySQLStore(pool);
    if (dOpts.sync) {
        // @ts-ignore
        await store._SyncTable();
    }
    return store;
};

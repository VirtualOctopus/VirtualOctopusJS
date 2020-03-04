/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { createMySQLStore } from "./MySQLStore";
import { ResourceProcessStatus } from "../models";
import { createPool } from "mysql2/promise";
import { size } from "lodash";

const CONN_HOST = process.env.MYSQL_HOST || "127.0.0.1";
const CONN_USER = process.env.MYSQL_USER;
const CONN_PASS = process.env.MYSQL_PASSWORD;
const CONN_DATABASE = process.env.MYSQL_DATABASE || "vo";
const CONN_PORT = parseInt(process.env.MYSQL_PORT || "3306", 10);

if (!CONN_USER) { // only test on mysql setup on env
    describe = describe.skip;
}

describe('MySQL Store Test Suite', () => {

    it('should assert status change', async () => {

        const pool = createPool({ host: CONN_HOST, user: CONN_USER, password: CONN_PASS, port: CONN_PORT });

        // setup database
        const conn = await pool.getConnection();
        const [results] = await conn.query(`show databases like '${CONN_DATABASE}'`);
        if (size(results) > 0) { // database exist
            await conn.changeUser({ database: CONN_DATABASE });
            const [r2] = await conn.query("show tables like 'vo_resource'");
            if (size(r2) > 0) { // vo.vo_resource table exist
                await conn.query("truncate table vo_resource;"); // clean table
            }
        } else {
            // database not exist
            await conn.query(`create database if not exists ${CONN_DATABASE};`); // create database
            conn.release();
        }

        const u1 = "https://qq.com/resource1";
        const store = await createMySQLStore({ host: CONN_HOST, user: CONN_USER, password: CONN_PASS, database: CONN_DATABASE, port: CONN_PORT });
        expect(await store.status(u1)).toBeNull();
        await store.save(u1, ResourceProcessStatus.NEW);
        expect(await store.status(u1)).toBe(ResourceProcessStatus.NEW);
        await store.save(u1, ResourceProcessStatus.LOCKED);
        expect(await store.status(u1)).toBe(ResourceProcessStatus.LOCKED);
        await store.save(u1, ResourceProcessStatus.PROCESSED);
        expect(await store.status(u1)).toBe(ResourceProcessStatus.PROCESSED);
        const r = await store.query(ResourceProcessStatus.PROCESSED);
        expect(r.length).toBe(1);
        expect(r).toStrictEqual([u1]);
        await store.release();

        const conn2 = await pool.getConnection();
        await conn2.changeUser({ database: CONN_DATABASE });
        await conn2.query("truncate table vo_resource;");
        conn2.release();
        await pool.end();

    });


});


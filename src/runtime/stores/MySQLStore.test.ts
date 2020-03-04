import { createMySQLStore } from "./MySQLStore";
import { ResourceProcessStatus } from "../models";
import { createConnection } from "mysql2/promise";

const CONN_HOST = process.env.MYSQL_HOST || "127.0.0.1";
const CONN_USER = process.env.MYSQL_USER;
const CONN_PASS = process.env.MYSQL_PASSWORD;
const CONN_DATABASE = process.env.MYSQL_DATABASE || "vo";

if (!CONN_USER) { // only test on mysql setup on env
    describe = describe.skip;
}

describe('MySQL Store Test Suite', () => {


    beforeAll(async () => {
        const conn = await createConnection({ host: CONN_HOST, user: CONN_USER, password: CONN_PASS, });
        await conn.query("create database if not exists vo;");
        await conn.end();
    });

    it('should assert status change', async () => {
        const u1 = "https://qq.com/resource1";
        const store = await createMySQLStore({ host: CONN_HOST, user: CONN_USER, password: CONN_PASS, database: CONN_DATABASE });
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

    });

    afterAll(async () => {
        const conn = await createConnection({ host: CONN_HOST, user: CONN_USER, password: CONN_PASS, database: CONN_DATABASE });
        await conn.query("truncate table vo;");
        await conn.end();
    });



});


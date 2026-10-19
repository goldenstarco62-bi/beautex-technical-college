import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    translateSqlForPostgres,
    getCurrentDateSQL,
    getDateIntervalSQL,
} from '../../src/config/database.js';

describe('translateSqlForPostgres (dual-engine rewrite invariants)', () => {
    it('date(now) -> CURRENT_DATE', () => {
        expect(translateSqlForPostgres(`SELECT * FROM t WHERE d = date('now')`))
            .toBe(`SELECT * FROM t WHERE d = CURRENT_DATE`);
    });
    it('date(now,+N days) -> CURRENT_DATE + INTERVAL', () => {
        expect(translateSqlForPostgres(`WHERE d < date('now', '+30 days')`))
            .toBe(`WHERE d < CURRENT_DATE + INTERVAL '30 days'`);
    });
    it('date(now,-N days) -> CURRENT_DATE - INTERVAL', () => {
        expect(translateSqlForPostgres(`WHERE d > date('now','-7 days')`))
            .toBe(`WHERE d > CURRENT_DATE - INTERVAL '7 days'`);
    });
    it(`datetime('now') -> CURRENT_TIMESTAMP`, () => {
        expect(translateSqlForPostgres(`UPDATE t SET updated = datetime('now')`))
            .toBe(`UPDATE t SET updated = CURRENT_TIMESTAMP`);
    });
    it('leaves ordinary SQL unchanged', () => {
        const sql = `SELECT id, name FROM students WHERE status = ?`;
        expect(translateSqlForPostgres(sql)).toBe(sql);
    });
});

describe('date helpers are engine-correct', () => {
    let savedUrl;
    beforeEach(() => { savedUrl = process.env.DATABASE_URL; delete process.env.DATABASE_URL; });
    afterEach(() => { if (savedUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = savedUrl; });

    it('sqlite: getCurrentDateSQL uses date(now)', () => {
        expect(getCurrentDateSQL()).toBe(`date('now')`);
    });
    it('sqlite: interval math uses sqlite modifiers', () => {
        expect(getDateIntervalSQL(30)).toBe(`date('now', '+30 days')`);
        expect(getDateIntervalSQL(-7)).toBe(`date('now', '-7 days')`);
    });
    it('postgres: helpers use CURRENT_DATE + INTERVAL', () => {
        process.env.DATABASE_URL = 'postgresql://user:pass@host:5432/db';
        expect(getCurrentDateSQL()).toBe('CURRENT_DATE');
        expect(getDateIntervalSQL(30)).toBe(`CURRENT_DATE + INTERVAL '30 days'`);
        expect(getDateIntervalSQL(-7)).toBe(`CURRENT_DATE - INTERVAL '7 days'`);
    });
});

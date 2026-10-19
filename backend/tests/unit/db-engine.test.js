import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getActiveDbEngine, getProcessedDatabaseUrl } from '../../src/config/database.js';

// These helpers read process.env at call time, so we can drive every branch
// without a connection. Importing database.js has no side effects.
let savedUrl, savedMongo;
beforeEach(() => {
    savedUrl = process.env.DATABASE_URL;
    savedMongo = process.env.MONGODB_URI;
    delete process.env.DATABASE_URL;
    delete process.env.MONGODB_URI;
});
afterEach(() => {
    if (savedUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = savedUrl;
    if (savedMongo === undefined) delete process.env.MONGODB_URI; else process.env.MONGODB_URI = savedMongo;
});

describe('getActiveDbEngine priority', () => {
    it('prefers mongodb when MONGODB_URI is set', () => {
        process.env.MONGODB_URI = 'mongodb://x';
        process.env.DATABASE_URL = 'postgres://y';
        expect(getActiveDbEngine()).toBe('mongodb');
    });
    it('chooses postgres for a postgres DATABASE_URL', () => {
        process.env.DATABASE_URL = 'postgresql://user:pass@host:5432/db';
        expect(getActiveDbEngine()).toBe('postgres');
    });
    it('falls back to sqlite with no URLs', () => {
        expect(getActiveDbEngine()).toBe('sqlite');
    });
    it('treats a non-postgres DATABASE_URL as sqlite', () => {
        process.env.DATABASE_URL = 'file:./database.sqlite';
        expect(getActiveDbEngine()).toBe('sqlite');
    });
});

describe('getProcessedDatabaseUrl', () => {
    it('returns null when unset', () => {
        expect(getProcessedDatabaseUrl()).toBeNull();
    });
    it('leaves a single-@ url untouched', () => {
        const u = 'postgresql://user:pass@host:5432/db';
        process.env.DATABASE_URL = u;
        expect(getProcessedDatabaseUrl()).toBe(u);
    });
    it('percent-encodes an @ inside the password', () => {
        process.env.DATABASE_URL = 'postgresql://user:pa@ss@host:5432/db';
        expect(getProcessedDatabaseUrl()).toBe('postgresql://user:pa%40ss@host:5432/db');
    });
});

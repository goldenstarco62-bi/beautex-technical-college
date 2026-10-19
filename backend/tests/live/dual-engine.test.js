import { describe, it, expect } from 'vitest';
import dotenv from 'dotenv';
import { query, queryOne, getActiveDbEngine, getProcessedDatabaseUrl } from '../../src/config/database.js';

dotenv.config();

// Read-only invariants against the real Postgres engine. These guard exactly the
// dual-engine bugs we fixed (boolean binding, id-less composite tables) so they
// can't silently regress. Skipped entirely when DATABASE_URL isn't Postgres,
// so a plain checkout / CI with no DB still passes.
const isLive = getActiveDbEngine() === 'postgres' && !!getProcessedDatabaseUrl();
describe.skipIf(!isLive)('live Postgres invariants', () => {
    it('boolean column binds a JS boolean parameter (no "boolean = integer")', async () => {
        // The pattern unitCoverageController now uses. Must not throw.
        const row = await queryOne(
            `SELECT name FROM academic_periods WHERE is_active = ? LIMIT 1`, [true]
        );
        // No assertion on the value (data-dependent) — reaching here means the
        // query executed cleanly, which is the invariant.
        expect(row === null || typeof row === 'object').toBe(true);
    });

    it('rejects the old integer-literal form (documents WHY the fix was needed)', async () => {
        await expect(query(
            `SELECT name FROM academic_periods WHERE is_active = true OR is_active = 1 LIMIT 1`, []
        )).rejects.toThrow(/boolean = integer/i);
    });

    it('diploma_streams is an id-less composite table (guards noIdTables)', async () => {
        const cols = await query(
            `SELECT column_name FROM information_schema.columns WHERE table_name = 'diploma_streams'`
        );
        const names = cols.map(c => String(c.column_name).toLowerCase());
        expect(names.length).toBeGreaterThan(0);
        expect(names).not.toContain('id');
    });
});

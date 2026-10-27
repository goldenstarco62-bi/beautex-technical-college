import { query, run, withTransaction, getActiveDbEngine } from '../config/database.js';
import logger from './logger.js';

const isPostgresEngine = () => getActiveDbEngine() === 'postgres';

async function listLiveTables() {
    if (isPostgresEngine()) {
        const rows = await query(
            `SELECT table_name AS name FROM information_schema.tables
             WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
        );
        return rows.map(r => r.name);
    }
    const rows = await query(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`);
    return rows.map(r => r.name);
}

async function listColumns(table) {
    if (isPostgresEngine()) {
        const rows = await query(
            `SELECT column_name AS name, data_type AS type FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = ? ORDER BY ordinal_position`,
            [table]
        );
        return rows.map(r => ({ name: r.name, type: (r.type || '').toLowerCase() }));
    }
    const rows = await query(`PRAGMA table_info("${table}")`);
    return rows.map(r => ({ name: r.name, type: (r.type || '').toLowerCase() }));
}

// Parent tables referenced by FKs from `table` — used to order deletes (children first)
// and inserts (parents first).
async function fkParents(table) {
    if (isPostgresEngine()) {
        const rows = await query(
            `SELECT DISTINCT confrelid::regclass::text AS parent
             FROM pg_constraint WHERE contype = 'f' AND conrelid = ?::regclass`,
            [table]
        );
        return rows.map(r => r.parent.replace(/^public\./, '').replace(/"/g, ''));
    }
    const rows = await query(`PRAGMA foreign_key_list("${table}")`);
    return [...new Set(rows.map(r => r.table))];
}

function topoSort(tables, parentsOf) {
    const result = [];
    const seen = new Set();
    const visiting = new Set();
    const inSet = new Set(tables);
    const visit = (t) => {
        if (seen.has(t) || visiting.has(t)) return; // also breaks FK cycles
        visiting.add(t);
        for (const p of parentsOf(t)) if (inSet.has(p)) visit(p);
        visiting.delete(t);
        seen.add(t);
        result.push(t);
    };
    for (const t of tables) visit(t);
    return result;
}

// PG sequences/identities are behind the explicit-PK inserts — advance them past the restored max.
async function resetSequences(table) {
    const seqCols = await query(
        `SELECT column_name AS name, pg_get_serial_sequence(table_name, column_name) AS seq
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = ?
           AND (column_default LIKE 'nextval%' OR is_identity = 'YES')`,
        [table]
    );
    for (const c of seqCols) {
        if (!c.seq) continue;
        const maxRow = await query(`SELECT COALESCE(MAX("${c.name}"), 0)::bigint AS m FROM "${table}"`);
        const max = Number(maxRow[0]?.m || 0);
        if (max > 0) await run(`SELECT setval('${c.seq}'::regclass, ${max}, true)`);
    }
}

function coerceValue(value, colType) {
    if (value === undefined) return null;
    if (value !== null && typeof value === 'object' && !Array.isArray(colType) && !['json', 'jsonb'].includes(colType)) {
        return JSON.stringify(value);
    }
    return value;
}

/**
 * Restore every table present in `data` (the `data` map of an export JSON):
 * wipe + reinsert inside ONE transaction, FK-aware ordering, per-table
 * savepoints so every table is attempted for a complete diagnostic report.
 * If any table fails, the whole transaction is rolled back (nothing applied).
 */
export async function restoreBackupData(data) {
    const live = await listLiveTables();
    const liveSet = new Set(live);
    const requested = Object.keys(data).filter(t => liveSet.has(t));
    const skipped = Object.keys(data).filter(t => !liveSet.has(t)).map(t => ({ table: t, reason: 'table not present in this database' }));

    const parentsCache = {};
    for (const t of requested) {
        try { parentsCache[t] = await fkParents(t); } catch { parentsCache[t] = []; }
    }
    const insertOrder = topoSort(requested, t => parentsCache[t] || []);
    const deleteOrder = [...insertOrder].reverse();

    const report = { restored: [], failed: [], skipped };

    await withTransaction(async () => {
        for (const t of deleteOrder) {
            await run(`DELETE FROM "${t}"`);
        }
        for (let i = 0; i < insertOrder.length; i++) {
            const table = insertOrder[i];
            const rows = Array.isArray(data[table]) ? data[table] : [];
            if (!rows.length) { report.restored.push({ table, rows: 0 }); continue; }
            const cols = await listColumns(table);
            const colMap = new Map(cols.map(c => [c.name.toLowerCase(), c]));
            const hasId = cols.some(c => c.name.toLowerCase() === 'id');
            const sp = `sp_restore_${i}`;
            await run(`SAVEPOINT ${sp}`);
            try {
                let n = 0;
                for (const row of rows) {
                    if (!row || typeof row !== 'object') continue;
                    const use = Object.keys(row).filter(k => colMap.has(k.toLowerCase()) && row[k] !== undefined);
                    if (!use.length) continue;
                    const names = use.map(k => `"${k}"`).join(', ');
                    const placeholders = use.map(() => '?').join(', ');
                    const values = use.map(k => coerceValue(row[k], colMap.get(k.toLowerCase()).type));
                    // run() auto-appends RETURNING id on PG for INSERTs unless the SQL
                    // already has RETURNING — protect tables without an id column.
                    const suffix = (!hasId && isPostgresEngine()) ? ' RETURNING 1' : '';
                    await run(`INSERT INTO "${table}" (${names}) VALUES (${placeholders})${suffix}`, values);
                    n++;
                }
                if (isPostgresEngine()) await resetSequences(table);
                await run(`RELEASE SAVEPOINT ${sp}`);
                report.restored.push({ table, rows: n });
            } catch (err) {
                await run(`ROLLBACK TO SAVEPOINT ${sp}`).catch(() => {});
                await run(`RELEASE SAVEPOINT ${sp}`).catch(() => {});
                logger.warn(`Restore: table "${table}" failed: ${err.message}`);
                report.failed.push({ table, error: String(err.message).slice(0, 300) });
            }
        }
        if (report.failed.length) {
            throw new Error(`Restore aborted: ${report.failed.length} table(s) failed — all changes rolled back`);
        }
    });

    return report;
}

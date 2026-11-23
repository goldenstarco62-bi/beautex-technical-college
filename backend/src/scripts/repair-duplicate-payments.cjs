/**
 * repair-duplicate-payments.cjs
 *
 * Audits and repairs the payments registry / student_fees ledger.
 *
 * Default (no flags): READ-ONLY report. Nothing is written.
 *
 *   node src/scripts/repair-duplicate-payments.cjs
 *
 * Apply actions (require explicit flags, run from the backend folder):
 *
 *   # Delete specific payment ids (use only ids confirmed as duplicates)
 *   node src/scripts/repair-duplicate-payments.cjs --apply --delete 29,30
 *
 *   # Rebuild every student_fees row from the payments table (no deletions)
 *   node src/scripts/repair-duplicate-payments.cjs --apply --resync
 *
 * Deleting a payment always re-derives that student's student_fees row and
 * monthly tracking from the remaining receipts.
 */
const dotenv = require('dotenv');
dotenv.config();

async function main() {
const { query, queryOne, run } = await import('../config/database.js');
const { syncStudentMonthlyFeeTracking } = await import('../controllers/monthlyFeeController.js');

const args = process.argv.slice(2);
const hasFlag = (f) => args.includes(f);
const flagValue = (f) => {
    const i = args.indexOf(f);
    return i !== -1 ? args[i + 1] : null;
};

const APPLY = hasFlag('--apply');
const DELETE_IDS = (flagValue('--delete') || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
const RESYNC_ALL = hasFlag('--resync');

const pad = (v, n) => String(v ?? '').padEnd(n);
const money = (v) => Number(v || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

if (process.env.MONGODB_URI) {
    console.error('This repair tool targets the SQL (PostgreSQL/SQLite) engine. MONGODB_URI is set — aborting.');
    process.exit(1);
}

async function audit() {
    console.log('=== 1. Exact duplicates (same student, amount, method, same second) ===\n');
    const exact = await query(`
        SELECT LOWER(TRIM(student_id)) AS sid, amount, method, payment_date::text AS paid_at,
               COUNT(*) AS copies, MIN(id) AS min_id
        FROM payments
        GROUP BY LOWER(TRIM(student_id)), amount, method, payment_date
        HAVING COUNT(*) > 1
        ORDER BY sid, paid_at
    `).catch(async () => {
        // SQLite has no ::text cast — fall back
        return query(`
            SELECT LOWER(TRIM(student_id)) AS sid, amount, method, payment_date AS paid_at,
                   COUNT(*) AS copies, MIN(id) AS min_id
            FROM payments
            GROUP BY LOWER(TRIM(student_id)), amount, method, payment_date
            HAVING COUNT(*) > 1
            ORDER BY sid, paid_at
        `);
    });

    if (!exact.length) {
        console.log('  none\n');
    } else {
        for (const r of exact) {
            const rows = await query(
                'SELECT id, transaction_ref, recorded_by, remarks FROM payments WHERE LOWER(TRIM(student_id)) = ? AND amount = ? AND method = ? AND payment_date = ?',
                [r.sid, r.amount, r.method, r.paid_at]
            ).catch(async () => {
                return query(
                    'SELECT id, transaction_ref, recorded_by, remarks FROM payments WHERE LOWER(TRIM(student_id)) = ? AND amount = ? AND method = ? AND payment_date::text = ?',
                    [r.sid, r.amount, r.method, r.paid_at]
                );
            });
            console.log(`  ${r.sid} | KSh ${money(r.amount)} | ${r.method} | ${r.paid_at} | ${r.copies} copies`);
            for (const row of rows) {
                console.log(`     id=${pad(row.id, 6)} ref=${pad(row.transaction_ref, 28)} by=${pad(row.recorded_by, 22)} ${row.remarks || ''}`);
            }
        }
        console.log('');
    }

    console.log('=== 2. Same-day same-amount candidates (possible duplicates — verify each) ===\n');
    let sameDay;
    try {
        sameDay = await query(`
            SELECT LOWER(TRIM(student_id)) AS sid, amount, method,
                   to_char(payment_date, 'YYYY-MM-DD') AS day, COUNT(*) AS copies
            FROM payments
            GROUP BY LOWER(TRIM(student_id)), amount, method, to_char(payment_date, 'YYYY-MM-DD')
            HAVING COUNT(*) > 1
            ORDER BY sid, day
        `);
    } catch {
        sameDay = await query(`
            SELECT LOWER(TRIM(student_id)) AS sid, amount, method,
                   strftime('%Y-%m-%d', payment_date) AS day, COUNT(*) AS copies
            FROM payments
            GROUP BY LOWER(TRIM(student_id)), amount, method, strftime('%Y-%m-%d', payment_date)
            HAVING COUNT(*) > 1
            ORDER BY sid, day
        `);
    }

    if (!sameDay.length) {
        console.log('  none\n');
    } else {
        for (const r of sameDay) {
            let rows;
            try {
                rows = await query(
                    `SELECT id, transaction_ref, recorded_by, payment_date
                     FROM payments
                     WHERE LOWER(TRIM(student_id)) = ?
                       AND amount = ?
                       AND CAST(payment_date AS DATE) = CAST(? AS DATE)
                       ${r.method ? 'AND method = ?' : 'AND method IS NULL'}
                     ORDER BY id`,
                    r.method ? [r.sid, r.amount, r.day, r.method] : [r.sid, r.amount, r.day]
                );
            } catch {
                rows = await query(
                    `SELECT id, transaction_ref, recorded_by, payment_date
                     FROM payments
                     WHERE LOWER(TRIM(student_id)) = ? AND amount = ?
                       AND strftime('%Y-%m-%d', payment_date) = ?
                     ORDER BY id`,
                    [r.sid, r.amount, r.day]
                );
            }
            console.log(`  ${r.sid} | KSh ${money(r.amount)} | ${r.method} | ${r.day} | ${r.copies} rows`);
            for (const row of rows) {
                console.log(`     id=${pad(row.id, 6)} ref=${pad(row.transaction_ref, 28)} by=${pad(row.recorded_by, 22)} ${row.payment_date}`);
            }
        }
        console.log('');
    }

    console.log('=== 3. Ledger drift: student_fees.total_paid vs SUM(payments) ===\n');
    const drift = await query(`
        WITH paid AS (
            SELECT LOWER(TRIM(student_id)) AS sid, SUM(amount) AS total
            FROM payments GROUP BY LOWER(TRIM(student_id))
        )
        SELECT s.id AS student_id, s.name,
               COALESCE(sf.total_due, 0)  AS total_due,
               COALESCE(sf.total_paid, 0) AS cached_paid,
               COALESCE(p.total, 0)       AS actual_paid,
               COALESCE(sf.total_paid, 0) - COALESCE(p.total, 0) AS diff
        FROM students s
        LEFT JOIN student_fees sf ON LOWER(TRIM(sf.student_id)) = LOWER(TRIM(s.id))
        LEFT JOIN paid p ON p.sid = LOWER(TRIM(s.id))
        WHERE ABS(COALESCE(sf.total_paid, 0) - COALESCE(p.total, 0)) > 0.009
        ORDER BY ABS(COALESCE(sf.total_paid, 0) - COALESCE(p.total, 0)) DESC
    `);

    if (!drift.length) {
        console.log('  none\n');
    } else {
        let aggregate = 0;
        for (const r of drift) {
            aggregate += Number(r.diff || 0);
            console.log(`  ${pad(r.student_id, 22)} ${pad(r.name, 30)} cached=${pad(money(r.cached_paid), 14)} actual=${pad(money(r.actual_paid), 14)} diff=${money(r.diff)}`);
        }
        console.log(`\n  ${drift.length} drifted account(s); net cached-over-actual difference: KSh ${money(aggregate)}\n`);
    }

    console.log('=== 4. Payments attached to unknown student ids ===\n');
    const orphans = await query(`
        SELECT LOWER(TRIM(p.student_id)) AS sid, COUNT(*) AS copies, SUM(p.amount) AS total
        FROM payments p
        WHERE NOT EXISTS (SELECT 1 FROM students s WHERE LOWER(TRIM(s.id)) = LOWER(TRIM(p.student_id)))
        GROUP BY LOWER(TRIM(p.student_id))
        ORDER BY sid
    `);
    if (!orphans.length) {
        console.log('  none\n');
    } else {
        for (const r of orphans) {
            console.log(`  ${pad(r.sid, 24)} rows=${pad(r.copies, 4)} total=KSh ${money(r.total)}`);
        }
        console.log('');
    }
}

async function rebuildStudent(canonicalId, dueOverride) {
    const paidRow = await queryOne(
        'SELECT COALESCE(SUM(amount), 0) AS total_paid, MAX(payment_date) AS last_date FROM payments WHERE LOWER(TRIM(student_id)) = LOWER(TRIM(?))',
        [canonicalId]
    );
    const totalPaid = parseFloat(paidRow?.total_paid || 0);
    const lastDate = paidRow?.last_date || null;

    const fee = await queryOne('SELECT total_due FROM student_fees WHERE LOWER(TRIM(student_id)) = LOWER(TRIM(?))', [canonicalId]);
    const totalDue = dueOverride !== undefined ? dueOverride : Number(fee?.total_due || 0);
    const balance = totalDue > 0 ? Math.max(0, totalDue - totalPaid) : 0;
    const status = (balance <= 0 && totalDue > 0) ? 'Paid' : (totalPaid > 0 ? 'Partial' : 'Pending');

    if (fee) {
        await run(
            'UPDATE student_fees SET total_paid = ?, balance = ?, status = ?, last_payment_date = ? WHERE LOWER(TRIM(student_id)) = LOWER(TRIM(?))',
            [totalPaid, balance, status, lastDate, canonicalId]
        );
    } else {
        await run(
            'INSERT INTO student_fees (student_id, total_due, total_paid, balance, status, last_payment_date) VALUES (?, ?, ?, ?, ?, ?)',
            [canonicalId, totalDue, totalPaid, balance, status, lastDate]
        );
    }
    await syncStudentMonthlyFeeTracking(canonicalId, totalDue);
    return { totalPaid, balance, status };
}

async function applyDeletions(ids) {
    console.log(`\n=== Deleting payment ids: ${ids.join(', ')} ===\n`);
    const affected = new Set();
    for (const id of ids) {
        const row = await queryOne('SELECT id, student_id, amount, transaction_ref FROM payments WHERE id = ?', [id]);
        if (!row) {
            console.log(`  id=${id}: NOT FOUND — skipped`);
            continue;
        }
        await run('DELETE FROM payments WHERE id = ?', [id]);
        affected.add(row.student_id);
        console.log(`  deleted id=${row.id} student=${row.student_id} amount=${money(row.amount)} ref=${row.transaction_ref || ''}`);
    }
    for (const sid of affected) {
        const res = await rebuildStudent(sid);
        console.log(`  rebuilt ${sid}: paid=${money(res.totalPaid)} balance=${money(res.balance)} status=${res.status}`);
    }
}

async function resyncAll() {
    console.log('\n=== Rebuilding every student_fees row from payments ===\n');
    const students = await query('SELECT id FROM students ORDER BY id');
    for (const s of students) {
        const res = await rebuildStudent(s.id);
        console.log(`  ${pad(s.id, 24)} paid=${pad(money(res.totalPaid), 14)} balance=${pad(money(res.balance), 14)} ${res.status}`);
    }
    console.log(`\n  ${students.length} account(s) rebuilt.`);
}

if (!APPLY) {
    await audit();
    console.log('READ-ONLY audit complete. Re-run with --apply --delete <ids> or --apply --resync to write changes.');
    process.exit(0);
}

if (DELETE_IDS.length === 0 && !RESYNC_ALL) {
    console.error('--apply requires --delete <id,id,...> and/or --resync.');
    process.exit(1);
}

if (DELETE_IDS.length > 0) {
    if (DELETE_IDS.length === 1) {
        console.warn('WARNING: only one id supplied — deleting a single row will not remove a duplicate pair.');
    }
    await applyDeletions(DELETE_IDS);
}

if (RESYNC_ALL) {
    await resyncAll();
}

console.log('\nDone.');
process.exit(0);
}

main().catch((err) => {
    console.error('Repair tool failed:', err);
    process.exit(1);
});

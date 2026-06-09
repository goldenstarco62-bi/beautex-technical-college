/**
 * clean-adj-payments.js
 *
 * Removes phantom "Ledger Adjustment" (ADJ-*) payment entries that were created
 * by the old buggy updateStudentFee logic, then recalculates student_fees.total_paid
 * from the remaining REAL payments only.
 *
 * Run from the backend folder: node clean-adj-payments.js
 */

import dotenv from 'dotenv';
dotenv.config();

import { query, queryOne, run } from './src/config/database.js';

console.log('🔍 Scanning for phantom ADJ payment entries...\n');

// Find all ADJ payments
const adjPayments = await query(`
    SELECT id, student_id, amount, transaction_ref, remarks, payment_date
    FROM payments
    WHERE transaction_ref LIKE 'ADJ-%' OR remarks = 'Ledger Adjustment'
    ORDER BY student_id, payment_date
`);

if (!adjPayments || adjPayments.length === 0) {
    console.log('✅ No phantom ADJ payment entries found. Database is clean.');
    process.exit(0);
}

console.log(`Found ${adjPayments.length} phantom ADJ payment(s):\n`);
adjPayments.forEach(p => {
    console.log(`  ID: ${p.id} | Student: ${p.student_id} | Amount: ${p.amount} | Ref: ${p.transaction_ref} | Date: ${p.payment_date}`);
});

// Affected students
const affectedStudents = [...new Set(adjPayments.map(p => p.student_id))];

console.log(`\n📊 Current state BEFORE cleanup:`);
for (const sid of affectedStudents) {
    const fee = await queryOne(`SELECT * FROM student_fees WHERE LOWER(TRIM(student_id)) = LOWER(TRIM(?))`, [sid]);
    const realSum = await queryOne(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM payments
        WHERE LOWER(TRIM(student_id)) = LOWER(TRIM(?))
        AND (transaction_ref NOT LIKE 'ADJ-%' AND (remarks IS NULL OR remarks != 'Ledger Adjustment'))
    `, [sid]);
    console.log(`  ${sid}: student_fees.total_paid=${fee?.total_paid}, real_payments_sum=${realSum?.total}`);
}

// Delete phantom ADJ payments
console.log('\n🗑️  Deleting phantom ADJ payment entries...');
const result = await run(`
    DELETE FROM payments
    WHERE transaction_ref LIKE 'ADJ-%' OR remarks = 'Ledger Adjustment'
`);
console.log(`  Deleted ${result.changes || 0} phantom payment entry(ies).`);

// Recalculate student_fees from REAL payments only
console.log('\n🔄 Recalculating student_fees.total_paid from real payments...');
for (const sid of affectedStudents) {
    const realSum = await queryOne(`
        SELECT COALESCE(SUM(amount), 0) as total_paid, MAX(payment_date) as last_date
        FROM payments
        WHERE LOWER(TRIM(student_id)) = LOWER(TRIM(?))
    `, [sid]);

    const fee = await queryOne(`SELECT * FROM student_fees WHERE LOWER(TRIM(student_id)) = LOWER(TRIM(?))`, [sid]);
    if (!fee) {
        console.log(`  ⚠️  No student_fees row for ${sid} — skipping`);
        continue;
    }

    const totalPaid = parseFloat(realSum.total_paid || 0);
    const totalDue  = parseFloat(fee.total_due || 0);
    const newBalance = totalDue > 0 ? Math.max(0, totalDue - totalPaid) : 0;
    const newStatus  = (newBalance <= 0 && totalDue > 0) ? 'Paid'
                     : (totalPaid > 0 ? 'Partial' : 'Pending');

    await run(`
        UPDATE student_fees
        SET total_paid = ?, balance = ?, status = ?, last_payment_date = ?
        WHERE LOWER(TRIM(student_id)) = LOWER(TRIM(?))
    `, [totalPaid, newBalance, newStatus, realSum.last_date, sid]);

    console.log(`  ✅ ${sid}: total_paid=${totalPaid}, balance=${newBalance}, status=${newStatus}`);
}

console.log('\n✅ Done. Phantom ADJ entries removed; balances recalculated from real payments.');
process.exit(0);

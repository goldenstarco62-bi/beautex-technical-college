/**
 * Force re-sync: delete stale records and re-run auto-init for current month.
 * Run with: node src/force-sync-monthly.js
 */
import 'dotenv/config';
import { query, queryOne, run } from './config/database.js';
import { autoInitializeCurrentMonth } from './controllers/monthlyFeeController.js';

async function forceSync() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    console.log(`\n🔄 Force-syncing monthly fee tracking for ${month}/${year}...\n`);

    // Step 1: Delete any existing (possibly broken) records for current month
    const deleted = await run(
        'DELETE FROM monthly_fee_tracking WHERE year = ? AND month = ?',
        [year, month]
    );
    console.log(`🗑️  Deleted ${deleted.changes ?? 0} existing records for ${month}/${year}`);

    // Step 2: Re-run auto-init
    console.log('⚡ Running autoInitializeCurrentMonth...');
    await autoInitializeCurrentMonth(year, month);

    // Step 3: Verify result
    const records = await query(
        'SELECT mft.student_id, s.name, mft.amount_due, mft.status FROM monthly_fee_tracking mft JOIN students s ON mft.student_id = s.id WHERE mft.year = ? AND mft.month = ?',
        [year, month]
    );
    console.log(`\n✅ Done! ${records.length} record(s) now in monthly_fee_tracking for ${month}/${year}:`);
    for (const r of records) {
        console.log(`   - ${r.name} (${r.student_id}): amount_due=${r.amount_due}, status=${r.status}`);
    }

    process.exit(0);
}

forceSync().catch(err => {
    console.error('Force sync error:', err);
    process.exit(1);
});

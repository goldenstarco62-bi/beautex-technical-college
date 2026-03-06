
import { queryOne, query } from '../backend/src/config/database.js';
import pkg from 'dotenv';
const { config } = pkg;
// Path relative to where node is run
config({ path: './backend/.env' });

async function check() {
    try {
        const paymentCount = await queryOne('SELECT COUNT(*) as count FROM payments');
        const feeSummary = await queryOne('SELECT SUM(total_paid) as total FROM student_fees');
        const totalPayments = await queryOne('SELECT SUM(amount) as total FROM payments');
        const countsPerStudent = await query(`
      SELECT student_id, COUNT(*) as count 
      FROM payments 
      GROUP BY student_id
      LIMIT 10
    `);

        console.log('--- SYSTEM STATUS (Checking Supabase @ Postgres) ---');
        console.log(`Payment Records: ${paymentCount.count}`);
        console.log(`Sum of all Payment Amounts: KSh ${totalPayments.total || 0}`);
        console.log(`Summary Total Paid (student_fees): KSh ${feeSummary.total || 0}`);
        console.log('----------------------------------------------------');

        if (Number(totalPayments.total) > Number(feeSummary.total)) {
            console.log('✅ Payments EXIST that are NOT reflected in the summary.');
        } else {
            console.log('Summary matches payment records.');
        }

        console.log('\nSample Student IDs in Payments:');
        console.log(countsPerStudent);

    } catch (err) {
        console.error('Check failed:', err.message);
    } finally {
        process.exit();
    }
}

check();

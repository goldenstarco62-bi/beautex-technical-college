import 'dotenv/config';
import { run, query } from './config/database.js';

async function fix() {
    try {
        console.log('🔧 Running non-destructive fixes...');
        // Just ensure essential tables exist and schema is correct
        const { initializeDatabase } = await import('./config/database.js');
        await initializeDatabase();
        console.log('✅ Fixes applied safely.');
    } catch (err) {
        console.error('❌ Fix failed:', err);
    }
    process.exit(0);
}
fix();

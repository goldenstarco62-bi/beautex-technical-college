import 'dotenv/config';
import { initializeDatabase } from './config/database.js';

async function runInit() {
    try {
        console.log('🚀 Starting Database Initialization...');
        await initializeDatabase();
        console.log('✅ Database Initialization Complete.');
    } catch (err) {
        console.error('❌ Database Initialization Failed:', err);
    }
    process.exit(0);
}

runInit();

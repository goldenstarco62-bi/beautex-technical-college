import { getDb, run } from '../config/database.js';

async function migrate() {
    try {
        const db = await getDb();
        const isMongo = db.constructor.name === 'NativeConnection';

        if (isMongo) {
            console.log('MongoDB detected - no migration needed (handled by Mongoose)');
            return;
        }

        console.log('Running migration: add must_change_password column...');

        // Check if column already exists
        const tableInfo = await db.all("PRAGMA table_info(users)");
        const columnExists = tableInfo.some(col => col.name === 'must_change_password');

        if (columnExists) {
            console.log('✅ Column must_change_password already exists');
            return;
        }

        // Add the column
        await run('ALTER TABLE users ADD COLUMN must_change_password BOOLEAN DEFAULT 1');
        console.log('✅ Added must_change_password column');

        // Update existing admin users to not require password change
        await run("UPDATE users SET must_change_password = 0 WHERE role IN ('superadmin', 'admin')");
        console.log('✅ Updated existing admin users');

        console.log('Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();

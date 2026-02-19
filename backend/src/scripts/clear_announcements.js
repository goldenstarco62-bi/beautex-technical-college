import { getDb, query, run } from '../config/database.js';

async function isMongo() {
    const db = await getDb();
    return db.constructor.name === 'NativeConnection';
}

async function clearAnnouncements() {
    console.log('🗑️  Permanently deleting all announcements...');
    try {
        if (await isMongo()) {
            const Announcement = (await import('../models/mongo/Announcement.js')).default;
            const result = await Announcement.deleteMany({});
            console.log(`✅ MongoDB: Deleted ${result.deletedCount} announcements.`);
        } else {
            await run('DELETE FROM announcements');
            console.log('✅ SQL: Announcements table cleared successfully!');
        }
        process.exit(0);
    } catch (error) {
        console.error('❌ Failed to clear announcements:', error);
        process.exit(1);
    }
}

clearAnnouncements();

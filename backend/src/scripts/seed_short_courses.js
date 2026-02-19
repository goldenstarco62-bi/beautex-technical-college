
import { getDb, run } from '../config/database.js';

async function isMongo() {
    try {
        const db = await getDb();
        return db.constructor.name === 'NativeConnection';
    } catch (e) {
        return false;
    }
}

const shortCourses = [
    { name: 'Makeup', duration: '1 Month' },
    { name: 'Sista Locks', duration: '1 Month' },
    { name: 'Braiding, Plaiting & Crotcheting', duration: '2 Months' },
    { name: 'Weaving & Wig Installation', duration: '6 Weeks' },
    { name: 'Nail Technology', duration: '6 Weeks' }
];

async function seedShortCourses() {
    console.log('🌱 Seeding short courses...');

    try {
        if (await isMongo()) {
            console.log('Skipping SQL seed (using MongoDB). Ensure Mongo equivalent is implemented if needed.');
            // Add Mongo implementation if necessary, but request seems to imply SQL or generalized logic.
            // Assuming SQL for the primary task context or sticking to `run` compatibility.
        } else {
            for (const course of shortCourses) {
                const id = `SC-${Math.floor(Math.random() * 10000)}`;
                const sql = `
                    INSERT OR IGNORE INTO courses (id, name, department, instructor, duration, capacity, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `;
                // Default values for missing fields
                await run(sql, [
                    id,
                    course.name,
                    'Short Course',
                    'TBD',
                    course.duration,
                    20,
                    'Active'
                ]);
            }
            console.log(`✅ Seeded ${shortCourses.length} short courses.`);
        }
        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding courses:', error);
        process.exit(1);
    }
}

seedShortCourses();

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../../database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.run("ALTER TABLE grades ADD COLUMN remarks TEXT;", (err) => {
        if (err) {
            if (err.message.includes('duplicate column name')) {
                console.log('Column already exists.');
            } else {
                console.error('Migration failed:', err.message);
                process.exit(1);
            }
        } else {
            console.log('Migration successful: Added remarks column.');
        }
        db.close();
    });
});

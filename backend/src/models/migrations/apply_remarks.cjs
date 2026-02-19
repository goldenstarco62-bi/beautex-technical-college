const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Try both locations for database
const dbPaths = [
    path.resolve(__dirname, '../../database.sqlite'),
    path.resolve(__dirname, '../../../database.sqlite')
];

function tryMigration(index) {
    if (index >= dbPaths.length) {
        console.error('Migration failed: Could not find database.sqlite in expected locations.');
        process.exit(1);
    }

    const dbPath = dbPaths[index];
    console.log(`Checking database at: ${dbPath}`);

    const fs = require('fs');
    if (!fs.existsSync(dbPath)) {
        console.log(`File not found at ${dbPath}, trying next...`);
        return tryMigration(index + 1);
    }

    const db = new sqlite3.Database(dbPath);

    db.serialize(() => {
        db.run("ALTER TABLE grades ADD COLUMN remarks TEXT;", (err) => {
            if (err) {
                if (err.message.includes('duplicate column name')) {
                    console.log('Column already exists in this database.');
                } else {
                    console.error(`Migration failed at ${dbPath}:`, err.message);
                    db.close();
                    return tryMigration(index + 1);
                }
            } else {
                console.log(`Migration successful at ${dbPath}: Added remarks column.`);
            }
            db.close();
            console.log('Migration process finished.');
        });
    });
}

tryMigration(0);

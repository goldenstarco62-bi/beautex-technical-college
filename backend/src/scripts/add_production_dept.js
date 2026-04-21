import { run } from '../config/database.js';

async function addDept() {
    try {
        console.log('Inserting "Production Unit" into departments table...');
        await run(
            'INSERT OR IGNORE INTO departments (name, description) VALUES (?, ?)',
            ['Production Unit', 'Internal production and practical unit for student projects and institutional assets.']
        );
        console.log('Success: "Production Unit" ensured in database.');
        process.exit(0);
    } catch (error) {
        console.error('Failed to add department:', error.message);
        process.exit(1);
    }
}

addDept();

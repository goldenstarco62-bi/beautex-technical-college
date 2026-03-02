
import { query } from './src/config/database.js';
import dotenv from 'dotenv';
dotenv.config();

async function inspectUsers() {
    console.log('🔍 Inspecting User Statuses...');
    try {
        const rows = await query("SELECT email, role, status FROM users");
        console.log(`Total users in DB: ${rows.length}`);

        const statusCounts = {};
        rows.forEach(r => {
            statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
        });
        console.log('Status counts:', statusCounts);

        const activeUsers = rows.filter(r => r.status === 'Active');
        console.log(`Active users found: ${activeUsers.length}`);

        if (activeUsers.length > 0) {
            console.log('Sample Active Users:');
            activeUsers.slice(0, 5).forEach(u => console.log(` - ${u.email} (${u.role})`));
        } else {
            console.log('❌ NO ACTIVE USERS FOUND with status="Active"');
            console.log('First 5 users for reference:');
            rows.slice(0, 5).forEach(u => console.log(` - ${u.email} (Status: ${u.status})`));
        }

    } catch (err) {
        console.error('❌ Error:', err.message);
    }
    process.exit();
}

inspectUsers();

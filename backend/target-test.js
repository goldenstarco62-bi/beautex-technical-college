
import { createAnnouncement } from './src/controllers/announcementController.js';
import { queryOne } from './src/config/database.js';
import { sendAnnouncementEmail } from './src/services/emailService.js';
import dotenv from 'dotenv';
dotenv.config();

async function singleUserTest() {
    const targetEmail = 'goldenstarco62@gmail.com';
    console.log(`🎯 Targeted Test for: ${targetEmail}`);

    const announcement = {
        title: "CRITICAL SYSTEM TEST - IGNORE",
        content: "This is a direct delivery test via the system to verify your inbox availability.",
        author: "System Debugger",
        category: "System",
        priority: "High"
    };

    const recipients = [targetEmail];
    console.log('📡 Dispatching...');
    try {
        const result = await sendAnnouncementEmail(announcement, recipients);
        console.log(`Result: ${result ? 'SUCCESS' : 'FAILURE'}`);
    } catch (err) {
        console.error('❌ Error in test:', err);
    }
    process.exit();
}

singleUserTest();

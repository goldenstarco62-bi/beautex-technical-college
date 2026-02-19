
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { sendWelcomeEmail } from './backend/src/services/emailService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, 'backend/.env') });

async function testEmail() {
    console.log('🧪 Testing Email Service...');
    console.log(`📡 SMTP User: ${process.env.SMTP_USER}`);

    // Using a known test email or the SMTP user itself to test
    const testEmail = process.env.SMTP_USER;
    const success = await sendWelcomeEmail(testEmail, 'test-role', 'test-password-123');

    if (success) {
        console.log('✅ Test email sent successfully!');
    } else {
        console.log('❌ Test email failed. Check the console logs above for errors.');
    }
}

testEmail();

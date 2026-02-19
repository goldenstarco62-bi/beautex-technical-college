
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, 'backend/.env') });

async function testSmtp() {
    console.log('🔍 Testing SMTP Settings...');
    console.log('User:', process.env.SMTP_USER);
    console.log('Pass length:', process.env.SMTP_PASS ? process.env.SMTP_PASS.length : 0);

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });

    try {
        console.log('⏳ Verifying connection...');
        await transporter.verify();
        console.log('✅ SMTP Connection is valid!');

        console.log('⏳ Sending test email...');
        const info = await transporter.sendMail({
            from: `"Beautex Test" <${process.env.SMTP_USER}>`,
            to: process.env.SMTP_USER,
            subject: 'SMTP Diagnostic Test',
            text: 'If you receive this, SMTP is working correctly.',
            html: '<b>If you receive this, SMTP is working correctly.</b>'
        });
        console.log('✅ Test email sent:', info.messageId);
        process.exit(0);
    } catch (error) {
        console.error('❌ SMTP Test Failed:', error);
        process.exit(1);
    }
}

testSmtp();

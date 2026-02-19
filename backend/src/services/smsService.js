import AfricasTalking from 'africastalking';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Africa's Talking
let sms = null;

const initializeSMS = () => {
    if (!process.env.AT_API_KEY || !process.env.AT_USERNAME) {
        console.warn('⚠️  Africa\'s Talking credentials not configured. SMS notifications will be disabled.');
        console.warn('   Set AT_API_KEY and AT_USERNAME in your .env file to enable SMS.');
        return null;
    }

    const africastalking = AfricasTalking({
        apiKey: process.env.AT_API_KEY,
        username: process.env.AT_USERNAME,
    });

    return africastalking.SMS;
};

/**
 * Format phone number to international format
 * Assumes Kenyan numbers if no country code is provided
 * @param {string} phoneNumber - Phone number to format
 * @returns {string} - Formatted phone number with country code
 */
const formatPhoneNumber = (phoneNumber) => {
    if (!phoneNumber) return null;

    // Remove all non-digit characters
    let cleaned = phoneNumber.replace(/\D/g, '');

    // If it starts with 0, remove it and add Kenya code
    if (cleaned.startsWith('0')) {
        cleaned = '254' + cleaned.substring(1);
    }

    // If it doesn't start with a country code, assume Kenya
    if (!cleaned.startsWith('254') && !cleaned.startsWith('+')) {
        cleaned = '254' + cleaned;
    }

    // Add + prefix
    if (!cleaned.startsWith('+')) {
        cleaned = '+' + cleaned;
    }

    return cleaned;
};

/**
 * Send login credentials via SMS
 * @param {string} phoneNumber - Recipient's phone number
 * @param {string} email - User's email (login username)
 * @param {string} temporaryPassword - Temporary password
 * @param {string} role - User role (student, teacher, admin)
 * @returns {Promise<boolean>} - Success status
 */
export const sendLoginCredentials = async (phoneNumber, email, temporaryPassword, role = 'user') => {
    try {
        // Initialize SMS service if not already done
        if (!sms) {
            sms = initializeSMS();
        }

        // If SMS is not configured, log and return false
        if (!sms) {
            console.log('📱 SMS not configured. Skipping SMS notification.');
            return false;
        }

        // Format phone number
        const formattedPhone = formatPhoneNumber(phoneNumber);
        if (!formattedPhone) {
            console.error('❌ Invalid phone number provided');
            return false;
        }

        // Construct message
        const message = `Welcome to Beautex College! Your login credentials:\nEmail: ${email}\nPassword: ${temporaryPassword}\n\nPlease change your password after first login.\n\nBeautex Technical Training College`;

        // Send SMS
        const options = {
            to: [formattedPhone],
            message: message,
            from: process.env.SMS_SENDER_ID || 'BEAUTEX',
        };

        console.log(`📱 Sending SMS to ${formattedPhone}...`);
        const response = await sms.send(options);

        // Check response
        if (response.SMSMessageData.Recipients[0].status === 'Success') {
            console.log(`✅ SMS sent successfully to ${formattedPhone}`);
            console.log(`   Message ID: ${response.SMSMessageData.Recipients[0].messageId}`);
            return true;
        } else {
            console.error(`❌ SMS failed: ${response.SMSMessageData.Recipients[0].status}`);
            return false;
        }

    } catch (error) {
        console.error('❌ Failed to send SMS:', error.message);
        return false;
    }
};

/**
 * Send password reset notification via SMS
 * @param {string} phoneNumber - Recipient's phone number
 * @param {string} resetCode - Password reset code
 * @returns {Promise<boolean>} - Success status
 */
export const sendPasswordResetSMS = async (phoneNumber, resetCode) => {
    try {
        if (!sms) {
            sms = initializeSMS();
        }

        if (!sms) {
            console.log('📱 SMS not configured. Skipping SMS notification.');
            return false;
        }

        const formattedPhone = formatPhoneNumber(phoneNumber);
        if (!formattedPhone) {
            console.error('❌ Invalid phone number provided');
            return false;
        }

        const message = `Your password reset code is: ${resetCode}\n\nThis code will expire in 1 hour.\n\nBeautex Technical Training College`;

        const options = {
            to: [formattedPhone],
            message: message,
            from: process.env.SMS_SENDER_ID || 'BEAUTEX',
        };

        console.log(`📱 Sending password reset SMS to ${formattedPhone}...`);
        const response = await sms.send(options);

        if (response.SMSMessageData.Recipients[0].status === 'Success') {
            console.log(`✅ Password reset SMS sent successfully to ${formattedPhone}`);
            return true;
        } else {
            console.error(`❌ SMS failed: ${response.SMSMessageData.Recipients[0].status}`);
            return false;
        }

    } catch (error) {
        console.error('❌ Failed to send password reset SMS:', error.message);
        return false;
    }
};

export default {
    sendLoginCredentials,
    sendPasswordResetSMS,
};

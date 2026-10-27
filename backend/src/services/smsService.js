import AfricasTalking from 'africastalking';
import dotenv from 'dotenv';
import { query } from '../config/database.js';
import logger from '../utils/logger.js';

dotenv.config();

// Credentials resolve from the Settings dashboard (system_settings) first,
// falling back to .env so existing deployments keep working.
export const getGatewayConfig = async () => {
    let dbVals = {};
    try {
        const rows = await query("SELECT key, value FROM system_settings WHERE key IN ('sms_api_key','sms_username','sms_sender_id')");
        for (const r of rows || []) dbVals[r.key] = String(r.value ?? '').trim();
    } catch (err) {
        logger.warn(`SMS settings lookup failed, falling back to env: ${err.message}`);
    }
    // A stored value of only asterisks is a masked placeholder, not a credential.
    const real = v => (v && !/^\*+$/.test(v) ? v : '');
    return {
        apiKey: real(dbVals.sms_api_key) || process.env.AT_API_KEY || '',
        username: real(dbVals.sms_username) || process.env.AT_USERNAME || '',
        senderId: real(dbVals.sms_sender_id) || process.env.SMS_SENDER_ID || 'BEAUTEX',
    };
};

let cachedClient = null; // { apiKey, username, sms } — rebuilt when credentials change

const getSmsClient = async () => {
    const cfg = await getGatewayConfig();
    if (!cfg.apiKey || !cfg.username) {
        logger.warn('SMS disabled: set sms_api_key/sms_username in Settings, or AT_API_KEY/AT_USERNAME in .env');
        return null;
    }
    if (!cachedClient || cachedClient.apiKey !== cfg.apiKey || cachedClient.username !== cfg.username) {
        cachedClient = { apiKey: cfg.apiKey, username: cfg.username, sms: AfricasTalking({ apiKey: cfg.apiKey, username: cfg.username }).SMS };
    }
    return cachedClient.sms;
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
        const cfg = await getGatewayConfig();
        const sms = await getSmsClient();
        if (!sms) {
            logger.info('📱 SMS not configured. Skipping login credentials SMS.');
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
            from: cfg.senderId,
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
        const cfg = await getGatewayConfig();
        const sms = await getSmsClient();
        if (!sms) {
            logger.info('📱 SMS not configured. Skipping password reset SMS.');
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
            from: cfg.senderId,
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

import axios from 'axios';
import dotenv from 'dotenv';
import moment from 'moment';

dotenv.config();

/**
 * Get M-Pesa Access Token
 */
const getAccessToken = async () => {
    const consumer_key = process.env.MPESA_CONSUMER_KEY;
    const consumer_secret = process.env.MPESA_CONSUMER_SECRET;
    const url = "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";

    // For production use: "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials"

    const auth = Buffer.from(`${consumer_key}:${consumer_secret}`).toString('base64');

    try {
        const response = await axios.get(url, {
            headers: {
                Authorization: `Basic ${auth}`
            }
        });
        return response.data.access_token;
    } catch (error) {
        console.error('❌ M-Pesa Access Token Error:', error.response?.data || error.message);
        throw new Error('Failed to get M-Pesa access token');
    }
};

/**
 * Format phone number to 254XXXXXXXXX
 */
const formatPhoneNumber = (phoneNumber) => {
    if (!phoneNumber) return null;
    let cleaned = phoneNumber.replace(/\D/g, '');
    if (cleaned.startsWith('0')) cleaned = '254' + cleaned.substring(1);
    if (!cleaned.startsWith('254')) cleaned = '254' + cleaned;
    return cleaned;
};

/**
 * Initiate M-Pesa STK Push (Lipa Na M-Pesa Online)
 * @param {string} phoneNumber - Recipient's phone number
 * @param {number} amount - Amount to request
 * @param {object} metadata - Optional metadata
 * @returns {Promise<object>} - Response from Safaricom
 */
export const initiateMpesaCheckout = async (phoneNumber, amount, _, metadata = {}) => {
    try {
        const accessToken = await getAccessToken();
        const url = "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/process";
        // For production: "https://api.safaricom.co.ke/mpesa/stkpush/v1/process"

        const timestamp = moment().format('YYYYMMDDHHmmss');
        const shortcode = process.env.MPESA_SHORTCODE;
        const passkey = process.env.MPESA_PASSKEY;
        const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
        const formattedPhone = formatPhoneNumber(phoneNumber);

        const requestBody = {
            BusinessShortCode: shortcode,
            Password: password,
            Timestamp: timestamp,
            TransactionType: "CustomerPayBillOnline",
            Amount: Math.round(amount),
            PartyA: formattedPhone,
            PartyB: shortcode,
            PhoneNumber: formattedPhone,
            CallBackURL: process.env.MPESA_CALLBACK_URL,
            AccountReference: metadata.studentId || "StudentFee",
            TransactionDesc: `Fee Payment for ${metadata.studentId || "Student"}`
        };

        console.log(`📡 Sending Daraja STK Push to ${formattedPhone} (amount: ${amount})...`);
        const response = await axios.post(url, requestBody, {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });

        console.log('✅ Safaricom STK Push response:', response.data);
        return response.data;
    } catch (error) {
        console.error('❌ Daraja STK Push Error:', error.response?.data || error.message);
        throw new Error(error.response?.data?.errorMessage || 'Failed to initiate M-Pesa STK push');
    }
};

export default {
    initiateMpesaCheckout,
};

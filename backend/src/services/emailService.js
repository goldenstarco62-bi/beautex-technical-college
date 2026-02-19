import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

// Create transporter
// For development, we use Ethereal if no real SMTP credentials are provided
const createTransporter = async () => {
    // Check for real SMTP credentials
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
        const config = {
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            }
        };

        // If generic SMTP host is provided, use it. Otherwise default to Gmail service.
        if (process.env.SMTP_HOST) {
            config.host = process.env.SMTP_HOST;
            config.port = process.env.SMTP_PORT || 587;
            config.secure = process.env.SMTP_SECURE === 'true'; // true for 465, false for others
        } else {
            config.service = 'gmail';
        }

        return nodemailer.createTransport(config);
    } else {
        // Use Ethereal for testing if no credentials are provided
        const testAccount = await nodemailer.createTestAccount();
        console.log('📧 Using Ethereal Email for testing');
        console.log(`   User: ${testAccount.user}`);
        console.log(`   Pass: ${testAccount.pass}`);

        return nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: {
                user: testAccount.user,
                pass: testAccount.pass,
            },
        });
    }
};

let transporter = null;

export const sendWelcomeEmail = async (email, role, tempPassword) => {
    try {
        if (!transporter) {
            transporter = await createTransporter();
        }

        const loginUrl = process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production' ? 'https://college-management-system-gczq.vercel.app' : 'http://localhost:5173');
        console.log(`📧 Dispatching email: To: ${email}, Login: ${loginUrl}, Mode: ${process.env.NODE_ENV}`);

        const info = await transporter.sendMail({
            from: `"Beautex Technical Training College" <${process.env.SMTP_USER}>`,
            to: email,
            subject: 'Welcome to Beautex Technical Training College - Your Login Credentials',
            html: `
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #ffffff; color: #1a202c;">
                    <div style="background-color: #800000; padding: 40px 20px; text-align: center;">
                        <h1 style="color: #ffffff; margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 2px;">Beautex Technical Training College</h1>
                        <p style="color: #ffd700; margin: 10px 0 0; font-size: 14px; font-weight: bold; letter-spacing: 1px;">ACADEMIC REGISTRY</p>
                    </div>
                    
                    <div style="padding: 40px;">
                        <h2 style="color: #800000; margin-top: 0; font-size: 20px;">Welcome to the College!</h2>
                        <p style="line-height: 1.6; color: #4a5568;">Dear member, your academic account has been successfully provisioned. You now have full access to the <strong>${role.toUpperCase()} Portal</strong>.</p>
                        
                        <div style="background-color: #fff9f0; border: 1px border-left: 4px solid #800000; padding: 25px; border-radius: 8px; margin: 30px 0;">
                            <p style="margin: 0 0 15px 0; font-size: 13px; color: #800000; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Your Secure Login Credentials</p>
                            <p style="margin: 0; font-size: 15px;"><strong>Official Email:</strong> <span style="color: #2d3748;">${email}</span></p>
                            <p style="margin: 10px 0 0; font-size: 15px;"><strong>Temporary Password:</strong> <span style="background-color: #800000; color: #ffffff; padding: 2px 8px; border-radius: 4px; font-family: monospace;">${tempPassword}</span></p>
                        </div>
                        
                        <div style="text-align: center; margin: 40px 0;">
                            <a href="${loginUrl}" style="background-color: #800000; color: #ffffff; padding: 15px 35px; text-decoration: none; border-radius: 12px; font-weight: bold; display: inline-block; box-shadow: 0 4px 6px rgba(128, 0, 0, 0.2);">Login to Your Portal</a>
                        </div>
                        
                        <div style="border-top: 1px solid #edf2f7; padding-top: 25px; margin-top: 20px;">
                            <p style="font-size: 13px; color: #718096; line-height: 1.6;">
                                <strong style="color: #e53e3e;">Important Security Note:</strong> For your protection, you will be required to change this temporary password during your first login. Please choose a strong, unique password.
                            </p>
                        </div>
                    </div>
                    
                    <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #edf2f7;">
                        <p style="margin: 0; font-size: 12px; color: #a0aec0;">&copy; 2026 Beautex Technical Training College. All rights reserved.</p>
                        <p style="margin: 5px 0 0; font-size: 11px; color: #cbd5e0;">Excellence in Technical Education</p>
                    </div>
                </div>
            `,
        });

        console.log(`📧 Email sent to ${email}: ${info.messageId}`);
        // Preview only available when using Ethereal account
        if (nodemailer.getTestMessageUrl(info)) {
            console.log(`🔗 Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
        }
        return true;
    } catch (error) {
        console.error('❌ Failed to send email:', error);
        return false;
    }
};

export const sendPasswordResetEmail = async (email, resetUrl) => {
    try {
        if (!transporter) {
            transporter = await createTransporter();
        }

        const info = await transporter.sendMail({
            from: `"Beautex Technical Training College" <${process.env.SMTP_USER}>`,
            to: email,
            subject: 'Reset Your Password - Beautex Technical Training College',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #4a154b;">Password Reset Request</h2>
                    <p>Hello,</p>
                    <p>We received a request to reset your password. Click the button below to reset it:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetUrl}" style="display: inline-block; background-color: #4a154b; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset Password</a>
                    </div>
                    <p><strong>This link will expire in 1 hour.</strong></p>
                    <p>If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>
                    <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666;">
                        If the button doesn't work, copy and paste this link into your browser:<br>
                        <a href="${resetUrl}" style="color: #4a154b; word-break: break-all;">${resetUrl}</a>
                    </p>
                </div>
            `,
        });

        console.log(`📧 Password reset email sent to ${email}: ${info.messageId}`);
        if (nodemailer.getTestMessageUrl(info)) {
            console.log(`🔗 Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
        }
        return true;
    } catch (error) {
        console.error('❌ Failed to send password reset email:', error);
        return false;
    }
};


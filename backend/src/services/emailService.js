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

        const loginUrl = process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production' ? 'https://beautex-technical-college-pvk4-6cpns98oy.vercel.app' : 'http://localhost:5173');
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

export const sendAdminResetPasswordEmail = async (email, tempPassword) => {
    try {
        if (!transporter) {
            transporter = await createTransporter();
        }

        const loginUrl = process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production' ? 'https://beautex-technical-college-pvk4-6cpns98oy.vercel.app' : 'http://localhost:5173');

        const info = await transporter.sendMail({
            from: `"Academic Registry" <${process.env.SMTP_USER}>`,
            to: email,
            subject: 'Account Password Reset - Beautex Technical Training College',
            html: `
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #ffffff; color: #1a202c;">
                    <div style="background-color: #800000; padding: 40px 20px; text-align: center;">
                        <h1 style="color: #ffffff; margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 2px;">Password Reset</h1>
                        <p style="color: #ffd700; margin: 10px 0 0; font-size: 14px; font-weight: bold; letter-spacing: 1px;">SECURE CREDENTIAL UPDATE</p>
                    </div>
                    
                    <div style="padding: 40px;">
                        <h2 style="color: #800000; margin-top: 0; font-size: 18px;">Hello,</h2>
                        <p style="line-height: 1.6; color: #4a5568;">Your portal password has been reset by the <strong>Academic Administrator</strong>. Please use the temporary credentials below to access your account.</p>
                        
                        <div style="background-color: #f7faf2; border-left: 4px solid #800000; padding: 25px; border-radius: 8px; margin: 30px 0;">
                            <p style="margin: 0 0 15px 0; font-size: 13px; color: #800000; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">New Access Credentials</p>
                            <p style="margin: 0; font-size: 15px;"><strong>Official Email:</strong> <span style="color: #2d3748;">${email}</span></p>
                            <p style="margin: 10px 0 0; font-size: 15px;"><strong>Temporary Password:</strong> <span style="background-color: #800000; color: #ffffff; padding: 2px 8px; border-radius: 4px; font-family: monospace;">${tempPassword}</span></p>
                        </div>
                        
                        <div style="text-align: center; margin: 40px 0;">
                            <a href="${loginUrl}" style="background-color: #800000; color: #ffffff; padding: 15px 35px; text-decoration: none; border-radius: 12px; font-weight: bold; display: inline-block;">Login to Portal</a>
                        </div>
                        
                        <div style="border-top: 1px solid #edf2f7; padding-top: 25px; margin-top: 20px;">
                            <p style="font-size: 13px; color: #718096; line-height: 1.6;">
                                <strong style="color: #e53e3e;">Security Requirement:</strong> You will be required to create a new permanent password immediately after logging in.
                            </p>
                        </div>
                    </div>
                </div>
            `,
        });

        console.log(`📧 Admin reset email sent to ${email}: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error('❌ Failed to send admin reset email:', error);
        return false;
    }
};

export const sendAnnouncementEmail = async (announcement, recipientEmails) => {
    if (!recipientEmails || recipientEmails.length === 0) return;

    try {
        if (!transporter) {
            transporter = await createTransporter();
        }

        const { title, content, author, category, priority } = announcement;
        const portalUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

        // Priority badge color
        const priorityColors = {
            high: '#dc2626',
            medium: '#d97706',
            low: '#16a34a',
        };
        const priorityColor = priorityColors[(priority || 'medium').toLowerCase()] || '#d97706';
        const priorityLabel = (priority || 'General').toUpperCase();
        const categoryLabel = (category || 'General').toUpperCase();

        const htmlBody = `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #ffffff; color: #1a202c;">
                <!-- Header -->
                <div style="background-color: #800000; padding: 36px 20px; text-align: center;">
                    <p style="color: #ffd700; margin: 0 0 8px; font-size: 11px; font-weight: bold; letter-spacing: 3px; text-transform: uppercase;">Beautex Technical Training College</p>
                    <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 1px;">📢 College Announcement</h1>
                    <p style="color: #ffffff; opacity: 0.75; margin: 8px 0 0; font-size: 13px;">${dateStr}</p>
                </div>

                <!-- Priority & Category Badges -->
                <div style="padding: 20px 40px 0; display: flex; gap: 8px;">
                    <span style="display: inline-block; background-color: ${priorityColor}; color: #fff; font-size: 11px; font-weight: 700; padding: 3px 12px; border-radius: 20px; letter-spacing: 1px; text-transform: uppercase;">${priorityLabel} PRIORITY</span>
                    <span style="display: inline-block; background-color: #e2e8f0; color: #4a5568; font-size: 11px; font-weight: 700; padding: 3px 12px; border-radius: 20px; letter-spacing: 1px; text-transform: uppercase; margin-left: 8px;">${categoryLabel}</span>
                </div>

                <!-- Body -->
                <div style="padding: 30px 40px 40px;">
                    <h2 style="color: #800000; margin: 0 0 16px; font-size: 20px; line-height: 1.3;">${title}</h2>
                    <div style="background-color: #f9fafb; border-left: 4px solid #800000; border-radius: 8px; padding: 20px 24px; margin-bottom: 28px;">
                        <p style="margin: 0; font-size: 15px; line-height: 1.8; color: #374151; white-space: pre-wrap;">${content}</p>
                    </div>

                    <p style="margin: 0 0 6px; font-size: 13px; color: #6b7280;">Posted by: <strong style="color: #1f2937;">${author || 'Administration'}</strong></p>

                    <!-- CTA -->
                    <div style="text-align: center; margin-top: 36px;">
                        <a href="${portalUrl}" style="background-color: #800000; color: #ffffff; padding: 14px 36px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 14px; display: inline-block; box-shadow: 0 4px 12px rgba(128, 0, 0, 0.25);">View on Portal</a>
                    </div>
                </div>

                <!-- Footer -->
                <div style="background-color: #f8fafc; padding: 20px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="margin: 0; font-size: 12px; color: #9ca3af;">© 2026 Beautex Technical Training College. All rights reserved.</p>
                    <p style="margin: 4px 0 0; font-size: 11px; color: #d1d5db;">This email was sent because you are a member of the Beautex College portal.</p>
                </div>
            </div>
        `;

        // Send to all recipients via BCC to protect privacy
        const info = await transporter.sendMail({
            from: `"Beautex Technical Training College" <${process.env.SMTP_USER}>`,
            to: process.env.SMTP_USER, // send to self
            bcc: recipientEmails.join(','),
            subject: `📢 [Announcement] ${title}`,
            html: htmlBody,
        });

        console.log(`📧 Announcement email sent to ${recipientEmails.length} recipient(s): ${info.messageId}`);
        if (nodemailer.getTestMessageUrl(info)) {
            console.log(`🔗 Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
        }
        return true;
    } catch (error) {
        console.error('❌ Failed to send announcement email:', error.message);
        return false;
    }
};

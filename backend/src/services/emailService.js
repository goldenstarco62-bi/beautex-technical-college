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

        // Robust Gmail configuration
        config.host = 'smtp.gmail.com';
        config.port = 587;
        config.secure = false; // use startTLS
        config.requireTLS = true;
        config.connectionTimeout = 10000; // 10s
        config.greetingTimeout = 10000;   // 10s
        config.tls = {
            rejectUnauthorized: false // Helps in many server environments
        };

        console.log(`📡 Initializing Secure SMTP Transporter for: ${process.env.SMTP_USER}`);
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
                        
                        <div style="background-color: #fff9f0; border: 1px solid #e2e8f0; border-left: 4px solid #800000; padding: 25px; border-radius: 8px; margin: 30px 0;">
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
    console.log(`📢 Announcement System: Preparing broadcast for ${recipientEmails.length} recipients...`);
    if (!recipientEmails || recipientEmails.length === 0) {
        console.warn('⚠️ Announcement Error: Empty recipient list provided.');
        return false;
    }

    try {
        if (!transporter) {
            console.log('🔄 Initializing Secure SMTP Transporter...');
            transporter = await createTransporter();
            
            // Add a timeout to verification to prevent hanging
            const verifyPromise = transporter.verify();
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('SMTP Verification Timeout (15s)')), 15000)
            );

            console.log('🧪 Performing SMTP Handshake...');
            await Promise.race([verifyPromise, timeoutPromise]);
            console.log('✅ SMTP Bridge Verified & Ready.');
        }

        const { title, content, author, category, priority } = announcement;
        const portalUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

        const priorityColors = { high: '#dc2626', medium: '#d97706', low: '#16a34a' };
        const priorityColor = priorityColors[(priority || 'medium').toLowerCase()] || '#d97706';
        const priorityLabel = (priority || 'General').toUpperCase();
        const categoryLabel = (category || 'General').toUpperCase();

        const htmlBody = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #f1f5f9; border-radius: 24px; overflow: hidden; background-color: #ffffff; color: #1e293b; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);">
                <!-- Elite Header -->
                <div style="background-color: #800000; padding: 32px 24px; text-align: center; background-image: linear-gradient(to bottom right, #800000, #5c0000);">
                    <p style="color: #ffd700; margin: 0 0 8px; font-size: 9px; font-weight: 900; letter-spacing: 3px; text-transform: uppercase; opacity: 0.9;">Beautex Technical Training College</p>
                    <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 900; letter-spacing: -0.5px; text-transform: uppercase;">📢 Official Bulletin</h1>
                    <div style="height: 2px; width: 30px; background-color: #ffd700; margin: 16px auto 0; opacity: 0.5;"></div>
                </div>

                <div style="padding: 30px;">
                    <!-- Metadata Row -->
                    <div style="margin-bottom: 24px; display: flex; align-items: center; gap: 10px;">
                        <span style="background-color: ${priorityColor}15; color: ${priorityColor}; font-size: 8px; font-weight: 900; padding: 5px 12px; border-radius: 8px; border: 1px solid ${priorityColor}30; text-transform: uppercase; letter-spacing: 1.2px;">
                            ${priorityLabel} PRIORITY
                        </span>
                        <span style="background-color: #f8fafc; color: #64748b; font-size: 8px; font-weight: 900; padding: 5px 12px; border-radius: 8px; border: 1px solid #e2e8f0; text-transform: uppercase; letter-spacing: 1.2px; margin-left: 6px;">
                            ${categoryLabel}
                        </span>
                        <span style="color: #94a3b8; font-size: 9px; font-weight: 700; margin-left: auto;">
                            ${dateStr}
                        </span>
                    </div>

                    <!-- Content Section -->
                    <h2 style="color: #800000; margin: 0 0 16px; font-size: 18px; font-weight: 900; line-height: 1.2; letter-spacing: -0.5px; text-transform: uppercase;">${title}</h2>
                    
                    <div style="background-color: #fdfcfb; border-left: 3px solid #800000; border-radius: 10px; padding: 24px; margin-bottom: 30px; border-top: 1px solid #f8fafc; border-right: 1px solid #f8fafc; border-bottom: 1px solid #f8fafc;">
                        <p style="margin: 0; font-size: 14px; line-height: 1.7; color: #334155; white-space: pre-wrap; font-weight: 500;">${content}</p>
                    </div>

                    <div style="margin-bottom: 30px; padding-bottom: 24px; border-bottom: 1px solid #f1f5f9;">
                        <p style="margin: 0; font-size: 10px; color: #94a3b8; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 4px;">Dispatch Authority</p>
                        <p style="margin: 0; font-size: 13px; color: #800000; font-weight: 900; text-transform: uppercase;">${author || 'College Administration'}</p>
                    </div>

                    <!-- CTA -->
                    <div style="text-align: center;">
                        <a href="${portalUrl}" style="background-color: #800000; color: #ffd700; padding: 14px 36px; text-decoration: none; border-radius: 12px; font-weight: 900; font-size: 12px; display: inline-block; text-transform: uppercase; letter-spacing: 2px; box-shadow: 0 8px 12px -3px rgba(128, 0, 0, 0.2); border: 1px solid rgba(255, 215, 0, 0.1);">
                            Access Student Portal
                        </a>
                    </div>
                </div>

                <!-- Footer -->
                <div style="background-color: #f8fafc; padding: 32px 40px; text-align: center; border-top: 1px solid #f1f5f9;">
                    <p style="margin: 0; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">© 2026 Beautex Technical Training College</p>
                    <p style="margin: 6px 0 0; font-size: 10px; color: #cbd5e1; font-weight: 500;">You are receiving this because you are an active member of our academic community.</p>
                </div>
            </div>
        `;

        console.log(`📡 [DISPATCH START] Initiating broadcast for: "${title}"`);
        console.log(`� Target: ${recipientEmails.length} active members.`);

        console.log(`🏁 Dispatching Bulletins to ${recipientEmails.length} members...`);

        let successCount = 0;
        let failCount = 0;

        for (const email of recipientEmails) {
            try {
                // Throttle to adhere to Gmail intake pace (1.5s per email)
                await new Promise(r => setTimeout(r, 1500));

                await transporter.sendMail({
                    from: `"Beautex Technical Training College" <${process.env.SMTP_USER}>`,
                    to: email,
                    subject: `📢 Announcement: ${title}`,
                    html: htmlBody,
                    // Add importance headers
                    priority: priority?.toLowerCase() === 'high' ? 'high' : 'normal',
                    headers: {
                        'X-Priority': priority?.toLowerCase() === 'high' ? '1 (Highest)' : '3 (Normal)',
                        'Importance': priority?.toLowerCase() === 'high' ? 'High' : 'Normal'
                    }
                });
                
                successCount++;
                if (successCount % 10 === 0 || successCount === recipientEmails.length) {
                    console.log(`📡 Broadcast Progress: ${successCount}/${recipientEmails.length} delivered.`);
                }
            } catch (err) {
                console.error(`❌ Dispatch Failure [${email}]:`, err.message);
                failCount++;
                // If it's a fatal SMTP error, stop the broadcast
                if (err.message.includes('Invalid login') || err.message.includes('Connection refused')) {
                    console.error('⛔ Critical SMTP Error: Aborting remaining broadcast.');
                    break;
                }
            }
        }

        console.log(`🏁 Broadcast Complete: ${successCount} successful, ${failCount} failed.`);

        // Send a single summary to the administrator
        try {
            await transporter.sendMail({
                from: `"System Monitor" <${process.env.SMTP_USER}>`,
                to: process.env.SMTP_USER,
                subject: `📊 Broadcast Report: ${title}`,
                html: `
                    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                        <h2 style="color: #800000;">Broadcast Summary</h2>
                        <p><strong>Announcement:</strong> ${title}</p>
                        <p><strong>Total Recipients:</strong> ${recipientEmails.length}</p>
                        <hr/>
                        <p style="color: green;">✅ <strong>Successfully Delivered:</strong> ${successCount}</p>
                        <p style="color: red;">❌ <strong>Failed:</strong> ${failCount}</p>
                        <p style="font-size: 12px; color: #666; margin-top: 20px;">This is an automated verification report.</p>
                    </div>
                `
            });
            console.log('📊 Summary report sent to administrator.');
        } catch (reportErr) {
            console.error('⚠️ Failed to send summary report:', reportErr.message);
        }

        return successCount > 0;
    } catch (error) {
        console.error('❌ Critical error in announcement broadcaster:', error.message);
        return false;
    }
};

const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const isEmailConfigured = () => {
    const user = process.env.EMAIL_USER ? process.env.EMAIL_USER.trim() : '';
    const pass = process.env.EMAIL_PASS ? process.env.EMAIL_PASS.trim().replace(/\s+/g, '') : '';
    if (!user || !pass) return false;
    const lowerUser = user.toLowerCase();
    if (lowerUser === 'dev@eventora.local' || lowerUser === '@gmail.com' || lowerUser === 'yourgmail@gmail.com') return false;
    if (pass === 'dummy_password' || pass === 'the_16_character_app_password') return false;
    return true;
};

const createTransporter = () => {
    const user = process.env.EMAIL_USER ? process.env.EMAIL_USER.trim() : '';
    const pass = process.env.EMAIL_PASS ? process.env.EMAIL_PASS.trim().replace(/\s+/g, '') : '';

    if (process.env.SMTP_HOST) {
        const port = Number(process.env.SMTP_PORT) || 587;
        const secure = process.env.SMTP_SECURE !== undefined
            ? process.env.SMTP_SECURE === 'true'
            : port === 465;

        return nodemailer.createTransport({
            host: process.env.SMTP_HOST.trim(),
            port,
            secure,
            auth: { user, pass },
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 15000,
            tls: {
                rejectUnauthorized: false
            }
        });
    }

    // Default to Gmail SMTP
    const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 465;
    const secure = process.env.SMTP_SECURE !== undefined
        ? process.env.SMTP_SECURE === 'true'
        : port === 465;

    return nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port,
        secure,
        auth: { user, pass },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
        tls: {
            rejectUnauthorized: false
        }
    });
};

const sendBookingEmail = async (userEmail, userName, eventTitle) => {
    if (!isEmailConfigured()) {
        console.warn(`[Email Warning] Skipping SMTP dispatch for booking confirmation to ${userEmail} (email unconfigured).`);
        return { success: false, reason: 'unconfigured', message: 'SMTP credentials not configured.' };
    }
    try {
        const transporter = createTransporter();
        const fromAddress = process.env.EMAIL_FROM || `"Eventora" <${process.env.EMAIL_USER.trim()}>`;
        const mailOptions = {
            from: fromAddress,
            to: userEmail,
            subject: `Booking Confirmed: ${eventTitle}`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2>Hi ${userName}!</h2>
                    <p>Your booking for the event <strong>${eventTitle}</strong> is successfully confirmed.</p>
                    <p>Thank you for choosing Eventora.</p>
                </div>
            `
        };
        const info = await transporter.sendMail(mailOptions);
        console.log(`[Email Success] Booking email sent to ${userEmail} (MessageId: ${info.messageId})`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error(`[Email Error] Failed to send booking email to ${userEmail}:`, error.message);
        return {
            success: false,
            reason: 'smtp_error',
            error: error.message,
            message: `Failed to deliver booking email: ${error.message}`
        };
    }
};

const sendOTPEmail = async (userEmail, otp, type) => {
    console.log(`[Eventora OTP] Type: ${type} | Recipient: ${userEmail} | Code: ${otp}`);
    if (!isEmailConfigured()) {
        const warning = 'SMTP credentials not configured (EMAIL_USER / EMAIL_PASS in server/.env). Verification email cannot be sent.';
        console.warn(`[Email Notice] ${warning}`);
        return { success: false, reason: 'unconfigured', message: warning };
    }

    try {
        const title = type === 'account_verification' ? 'Verify your Eventora Account' : 'Eventora Booking Verification';
        const msg = type === 'account_verification'
            ? 'Please use the following OTP to verify your new Eventora account.'
            : 'Please use the following OTP to verify and confirm your event booking.';

        const transporter = createTransporter();
        const fromAddress = process.env.EMAIL_FROM || `"Eventora" <${process.env.EMAIL_USER.trim()}>`;
        const mailOptions = {
            from: fromAddress,
            to: userEmail,
            subject: title,
            html: `
                <div style="font-family: Arial, sans-serif; text-align: center; padding: 25px; border: 1px solid #e5e7eb; border-radius: 12px; max-width: 480px; margin: 0 auto;">
                    <h2 style="color: #111827; margin-bottom: 8px;">${title}</h2>
                    <p style="color: #4b5563; font-size: 15px; margin-bottom: 20px;">${msg}</p>
                    <div style="margin: 20px auto; padding: 14px 24px; font-size: 28px; font-weight: bold; letter-spacing: 6px; background-color: #f3f4f6; color: #111827; border-radius: 8px; width: max-content;">
                        ${otp}
                    </div>
                    <p style="color: #6b7280; font-size: 13px; margin-top: 20px;">This code expires in 5 minutes.<br/>If you did not request this, you can safely ignore this email.</p>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`[Email Success] OTP successfully delivered to ${userEmail} (MessageId: ${info.messageId})`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error(`[Email Error] Failed to send OTP email to ${userEmail}:`, error.message);
        return {
            success: false,
            reason: 'smtp_error',
            error: error.message,
            message: `Failed to deliver email: ${error.message}`
        };
    }
};

const verifyTransporterConnection = async () => {
    if (!isEmailConfigured()) {
        return { configured: false, error: 'EMAIL_USER or EMAIL_PASS missing or placeholder in server/.env' };
    }
    try {
        const transporter = createTransporter();
        await transporter.verify();
        return { configured: true, valid: true };
    } catch (err) {
        return { configured: true, valid: false, error: err.message };
    }
};

module.exports = {
    isEmailConfigured,
    sendBookingEmail,
    sendOTPEmail,
    verifyTransporterConnection
};

const User = require('../models/User');
const OTP = require('../models/OTP');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sendOTPEmail } = require('../utils/email');

const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const RESEND_COOLDOWN_SECONDS = 60;  // 60 seconds cooldown
const MAX_ATTEMPTS = 5;

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const generateToken = (id, role) => {
    return jwt.sign({ id, role }, process.env.JWT_SECRET || 'defaultsecretkey', { expiresIn: '30d' });
};

exports.register = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!email || !password || !name) {
            return res.status(400).json({ message: 'Name, email, and password are required' });
        }

        const normalizedEmail = email.toLowerCase().trim();
        let user = await User.findOne({ email: normalizedEmail });

        if (user && user.isVerified) {
            return res.status(400).json({ message: 'An account with this email already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        if (user && !user.isVerified) {
            // Update unverified user credentials to allow retry
            user.name = name.trim();
            user.password = hashedPassword;
            await user.save();
        } else {
            user = await User.create({
                name: name.trim(),
                email: normalizedEmail,
                password: hashedPassword,
                role: 'user',
                isVerified: false
            });
        }

        // Clean up previous OTPs for this email and action
        await OTP.deleteMany({ email: normalizedEmail, action: 'account_verification' });

        const otp = generateOTP();
        await OTP.create({ email: normalizedEmail, otp, action: 'account_verification' });
        const emailResult = await sendOTPEmail(normalizedEmail, otp, 'account_verification');

        if (!emailResult.success) {
            console.error(`[Register] Email dispatch failed for ${normalizedEmail}: ${emailResult.message}`);
            return res.status(503).json({
                message: emailResult.message || 'Failed to send verification email. Please check server email configuration or try again later.',
                emailSent: false,
                reason: emailResult.reason
            });
        }

        res.status(201).json({
            message: 'OTP sent to your email. Please verify.',
            email: user.email,
            emailSent: true
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

exports.resendOTP = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const user = await User.findOne({ email: normalizedEmail });

        if (!user) {
            return res.status(404).json({ message: 'No account found with this email' });
        }

        if (user.isVerified) {
            return res.status(400).json({ message: 'Account is already verified. You can log in.' });
        }

        // Check cooldown from previous OTP
        const existingOTP = await OTP.findOne({ email: normalizedEmail, action: 'account_verification' });
        if (existingOTP) {
            const elapsedSeconds = Math.floor((Date.now() - new Date(existingOTP.createdAt).getTime()) / 1000);
            if (elapsedSeconds < RESEND_COOLDOWN_SECONDS) {
                const waitTime = RESEND_COOLDOWN_SECONDS - elapsedSeconds;
                return res.status(429).json({
                    message: `Please wait ${waitTime}s before requesting a new code.`,
                    secondsRemaining: waitTime
                });
            }
        }

        // Delete previous OTP
        await OTP.deleteMany({ email: normalizedEmail, action: 'account_verification' });

        // Generate and send new OTP
        const otp = generateOTP();
        await OTP.create({ email: normalizedEmail, otp, action: 'account_verification' });
        const emailResult = await sendOTPEmail(normalizedEmail, otp, 'account_verification');

        if (!emailResult.success) {
            console.error(`[ResendOTP] Email dispatch failed for ${normalizedEmail}: ${emailResult.message}`);
            return res.status(503).json({
                message: emailResult.message || 'Failed to resend verification email. Please check server email configuration or try again later.',
                emailSent: false,
                reason: emailResult.reason
            });
        }

        res.json({
            message: 'A new OTP has been sent to your email.',
            email: user.email,
            emailSent: true,
            cooldownSeconds: RESEND_COOLDOWN_SECONDS
        });
    } catch (error) {
        console.error('Resend OTP error:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const user = await User.findOne({ email: normalizedEmail });
        if (!user) return res.status(400).json({ message: 'Invalid credentials' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

        if (!user.isVerified && user.role !== 'admin') {
            // Check if existing OTP is still within cooldown before regenerating
            const existingOTP = await OTP.findOne({ email: normalizedEmail, action: 'account_verification' });
            let otp;
            let emailResult = { success: true };
            if (!existingOTP || (Date.now() - new Date(existingOTP.createdAt).getTime()) > RESEND_COOLDOWN_SECONDS * 1000) {
                otp = generateOTP();
                await OTP.deleteMany({ email: normalizedEmail, action: 'account_verification' });
                await OTP.create({ email: normalizedEmail, otp, action: 'account_verification' });
                emailResult = await sendOTPEmail(normalizedEmail, otp, 'account_verification');
            }
            if (!emailResult.success) {
                return res.status(503).json({
                    message: emailResult.message || 'Account not verified, but failed to send verification email. Please check server email configuration.',
                    needsVerification: true,
                    emailSent: false,
                    email: user.email
                });
            }
            return res.status(403).json({
                message: 'Account not verified. A verification OTP has been sent to your email.',
                needsVerification: true,
                email: user.email,
                emailSent: true
            });
        }

        res.json({
            _id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            token: generateToken(user.id, user.role)
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

exports.verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({ message: 'Email and verification code are required' });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const trimmedOTP = otp.toString().trim();

        const activeOTP = await OTP.findOne({ email: normalizedEmail, action: 'account_verification' });

        if (!activeOTP) {
            return res.status(400).json({ message: 'Verification code not found or expired. Please request a new code.' });
        }

        // Expiration check (5 minutes)
        const isExpired = Date.now() - new Date(activeOTP.createdAt).getTime() > OTP_EXPIRY_MS;
        if (isExpired) {
            await OTP.deleteOne({ _id: activeOTP._id });
            return res.status(400).json({ message: 'Verification code has expired. Please request a new one.' });
        }

        // Rate-limiting check for incorrect attempts
        if (activeOTP.attempts >= MAX_ATTEMPTS) {
            await OTP.deleteOne({ _id: activeOTP._id });
            return res.status(429).json({ message: 'Too many incorrect attempts. This code has been invalidated. Please request a new one.' });
        }

        // Validate code
        if (activeOTP.otp !== trimmedOTP) {
            activeOTP.attempts += 1;
            await activeOTP.save();
            const attemptsLeft = MAX_ATTEMPTS - activeOTP.attempts;
            if (attemptsLeft <= 0) {
                await OTP.deleteOne({ _id: activeOTP._id });
                return res.status(400).json({ message: 'Invalid verification code. Maximum attempts reached. Please request a new code.' });
            }
            return res.status(400).json({ message: `Invalid verification code. ${attemptsLeft} attempt(s) remaining.` });
        }

        // OTP is correct! Mark user as verified
        const user = await User.findOneAndUpdate({ email: normalizedEmail }, { isVerified: true }, { new: true });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Delete all OTPs for this user immediately to prevent reuse
        await OTP.deleteMany({ email: normalizedEmail, action: 'account_verification' });

        res.json({
            _id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            token: generateToken(user.id, user.role)
        });
    } catch (error) {
        console.error('Verify OTP error:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

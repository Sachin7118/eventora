const express = require('express');
const router = express.Router();
const { register, login, verifyOTP, resendOTP } = require('../controllers/authController');
const { isEmailConfigured, verifyTransporterConnection } = require('../utils/email');

router.post('/register', register);
router.post('/login', login);
router.post('/verify-otp', verifyOTP);
router.post('/resend-otp', resendOTP);

router.get('/smtp-status', async (req, res) => {
    try {
        const configured = isEmailConfigured();
        if (!configured) {
            return res.json({
                configured: false,
                message: 'EMAIL_USER or EMAIL_PASS is missing or placeholder in server/.env'
            });
        }
        const check = await verifyTransporterConnection();
        return res.json(check);
    } catch (err) {
        return res.status(500).json({ configured: true, valid: false, error: err.message });
    }
});

module.exports = router;

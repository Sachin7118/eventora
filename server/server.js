const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });

const authRoutes = require('./routes/auth');
const eventRoutes = require('./routes/events');
const bookingRoutes = require('./routes/bookings');
const { isEmailConfigured, verifyTransporterConnection } = require('./utils/email');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/bookings', bookingRoutes);

// Database Connection
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/eventora')
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.error('MongoDB Connection Error:', err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    if (isEmailConfigured()) {
        const verifyStatus = await verifyTransporterConnection();
        if (verifyStatus.valid) {
            console.log('[Email] Transporter verified successfully - ready to dispatch emails via SMTP.');
        } else {
            console.warn('[Email Warning] SMTP credentials provided but connection verification failed:', verifyStatus.error);
        }
    } else {
        console.warn('[Email Notice] SMTP not configured (EMAIL_USER / EMAIL_PASS missing or placeholder in server/.env).');
    }
});

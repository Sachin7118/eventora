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
const allowedOrigins = process.env.CLIENT_URL
  ? [process.env.CLIENT_URL.trim().replace(/\/+$/, ''), 'http://localhost:5173']
  : '*';

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json());

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    mongoStatus: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.json({ message: 'Eventora API is running', health: '/health' });
});

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

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import userRoutes from './routes/userRoutes.js';
import kycRoutes from './routes/kycRoutes.js';
import apiClientRoutes from './routes/apiClientRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import webhookRoutes from './routes/webhookRoutes.js';
import apiUsageRoutes from './routes/apiUsageRoutes.js';
import { rateLimit } from './middlewares/rateLimit.js';
import { trackApiUsage } from './controllers/apiUsageController.js';
import cookieParser from 'cookie-parser';
import { initializeContainers } from './utils/azureStorage.js';

dotenv.config();

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true
}));
app.use(helmet());
app.use(morgan('dev'));

// Initialize Azure Storage containers
initializeContainers()
  .then(() => console.log('Azure Storage containers initialized successfully'))
  .catch((err) => console.error('Azure Storage containers initialization error:', err));

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ekyc-platform')
    .then(() => console.log('MongoDB connected successfully'))
    .catch((err) => console.error('MongoDB connection error:', err));

// API routes with rate limiting and usage tracking
app.use('/api/users', userRoutes);
app.use('/api/kyc', kycRoutes);
app.use('/api/clients', apiClientRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/usage', apiUsageRoutes);

// Apply rate limiting and usage tracking to all API routes
app.use('/api', rateLimit);
app.use('/api', trackApiUsage);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: 'Something went wrong!'
    });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
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

// Load environment variables
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

// MongoDB connection options
const mongooseOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 30000, // Increase timeout to 30 seconds
  socketTimeoutMS: 45000,
  connectTimeoutMS: 30000,
  maxPoolSize: 10,
  minPoolSize: 5,
};

// Connect to MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ekyc-platform', mongooseOptions);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Handle connection errors after initial connection
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
    });

    // Handle process termination
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('MongoDB connection closed through app termination');
      process.exit(0);
    });

  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
};

// Initialize Azure Storage containers
initializeContainers()
  .then(() => console.log('Azure Storage containers initialized successfully'))
  .catch((err) => console.error('Azure Storage containers initialization error:', err));

// Connect to database before starting the server
connectDB().then(() => {
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

  // Simple Hello World route
  app.get('/', (req, res) => {
    res.json({ message: 'Hello World' });
  });

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
});
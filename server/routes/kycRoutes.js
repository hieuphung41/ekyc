import express from 'express';
import {
    submitKYC,
    uploadBiometric,
    getKYCStatus,
    verifyKYC,
    getAllKYC
} from '../controllers/kycController.js';
import { protect, authorize } from '../middlewares/auth.js';
import { uploadMiddleware } from '../utils/fileUpload.js';

const router = express.Router();

// Protected routes
router.post('/submit', protect, submitKYC);
router.post('/biometric', protect, uploadMiddleware.single('file'), uploadBiometric);
router.get('/status', protect, getKYCStatus);

// Admin routes
router.get('/all', protect, authorize('admin'), getAllKYC);
router.put('/verify/:id', protect, authorize('admin'), verifyKYC);

export default router; 
import express from 'express';
import {
  getVerificationStatus,
  uploadFacePhoto,
  uploadIDDocument,
  resetVerificationStep,
  getAllVerifications,
  verifyKYC
} from '../controllers/verificationController.js';
import { protect, authorize } from '../middlewares/auth.js';
import { uploadMiddleware } from '../utils/fileUpload.js';

const router = express.Router();

// Get verification status
router.get('/status', protect, getVerificationStatus);

// Upload face photo
router.post(
  '/face',
  protect,
  uploadMiddleware.single('file'),
  uploadFacePhoto
);

// Upload ID document
router.post(
  '/document',
  protect,
  uploadMiddleware.fields([
    { name: 'frontImage', maxCount: 1 },
    { name: 'backImage', maxCount: 1 }
  ]),
  uploadIDDocument
);

// Reset verification step
router.post('/reset-step', protect, resetVerificationStep);

// Admin routes
router.get('/all', protect, authorize('admin'), getAllVerifications);
router.put('/verify/:id', protect, authorize('admin'), verifyKYC);

export default router; 
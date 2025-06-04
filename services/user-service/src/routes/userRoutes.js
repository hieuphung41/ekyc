import express from 'express';
import { 
  register, 
  login, 
  getProfile, 
  updateProfile,
  generateApiKey,
  verifyApiKey
} from '../controllers/userController.js';
import { protect } from '../middleware/authMiddleware.js';
import {
  registerValidation,
  loginValidation,
  updateProfileValidation
} from '../middleware/validationMiddleware.js';

const router = express.Router();

// Public routes
router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);
router.post('/verify-api-key', verifyApiKey);

// Protected routes
router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfileValidation, updateProfile);
router.post('/generate-api-key', protect, generateApiKey);

export default router; 
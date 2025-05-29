import express from 'express';
import {
    registerClient,
    getClient,
    updateClient,
    generateApiKey,
    getAllClients,
    authenticateClient,
    loginRepresentative,
    checkClientAuthStatus,
    logoutClient
} from '../controllers/apiClientController.js';
import { protect, authorize } from '../middlewares/auth.js';

const router = express.Router();

// Public routes
router.post('/register', registerClient);
router.post('/login', loginRepresentative);
router.post('/auth', authenticateClient);

// New route to check API client auth status
router.get('/check-auth', protect, checkClientAuthStatus);

// Protected routes (API client representative)
router.post('/logout', protect, logoutClient);
router.get('/profile', protect, getClient);
router.put('/profile', protect, updateClient);
router.post('/generate-key', protect, generateApiKey);

// Admin only routes
router.get('/', protect, authorize('admin'), getAllClients);
router.get('/:id', protect, authorize('admin'), getClient);
router.put('/:id', protect, authorize('admin'), updateClient);
router.post('/:id/generate-key', protect, authorize('admin'), generateApiKey);

export default router; 
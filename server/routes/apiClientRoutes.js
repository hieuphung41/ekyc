import express from 'express';
import {
    registerClient,
    getClient,
    updateClient,
    generateApiKey,
    getAllClients,
    authenticateClient
} from '../controllers/apiClientController.js';
import { protect, authorize } from '../middlewares/auth.js';

const router = express.Router();

// Public routes
router.post('/auth', authenticateClient);

// Protected routes (Admin only)
router.post('/register', protect, authorize('admin'), registerClient);
router.get('/', protect, authorize('admin'), getAllClients);
router.get('/:id', protect, authorize('admin'), getClient);
router.put('/:id', protect, authorize('admin'), updateClient);
router.post('/:id/generate-key', protect, authorize('admin'), generateApiKey);

export default router; 
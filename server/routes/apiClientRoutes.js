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
    logoutClient,
    getApiKeys,
    revokeApiKey,
    regenerateApiKey,
    getApiReport,
    getEndpointReport,
    getClientUsers,
    updateUserStatus,
} from '../controllers/apiClientController.js';
import { protect, authorize } from '../middlewares/auth.js';

const router = express.Router();

// Public routes
router.post('/register', registerClient);
router.post('/login', loginRepresentative);
router.post('/auth', authenticateClient);
router.get('/', getAllClients);

// New route to check API client auth status
router.get('/check-auth', protect, checkClientAuthStatus);

// Protected routes (API client representative)
router.post('/logout', protect, logoutClient);
router.get('/profile', protect, getClient);
router.put('/profile', protect, updateClient);

// User Management Routes (Protected)
router.get('/users', protect, getClientUsers);
router.put('/users/:userId/status', protect, updateUserStatus);

// API Key Management Routes (Protected)
router.get('/api-keys', protect, getApiKeys);
router.post('/api-keys/generate', protect, generateApiKey);
router.post('/api-keys/revoke', protect, revokeApiKey);
router.post('/api-keys/regenerate', protect, regenerateApiKey);

// API Report Routes (Protected)
router.get('/api-report', protect, getApiReport);
router.get('/api-report/:endpoint', protect, getEndpointReport);

// Admin only routes
router.get('/:id', protect, authorize('admin'), getClient);
router.put('/:id', protect, authorize('admin'), updateClient);
router.post('/:id/generate-key', protect, authorize('admin'), generateApiKey);

export default router; 
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
    getClientInfo,
    updateClientInfo,
    updateSubscription,
    getSubscriptionStatus,
    updateClientSettings,
    getClientUsage,
    updateBillingSettings,
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

// Client management
router.get('/profile', protect, getClientInfo);
router.put('/profile', protect, updateClientInfo);

// Settings management
router.get('/settings', protect, getClientInfo);
router.put('/settings', protect, updateClientSettings);

// Usage and statistics
router.get('/usage', protect, getClientUsage);

// Subscription management
router.get('/subscription', protect, getSubscriptionStatus);
router.put('/subscription', protect, authorize('admin'), updateSubscription);

// Billing management
router.put('/billing', protect, updateBillingSettings);

// Admin only routes
router.get('/:id', protect, authorize('admin'), getClient);
router.put('/:id', protect, authorize('admin'), updateClient);
router.post('/:id/generate-key', protect, authorize('admin'), generateApiKey);

export default router; 
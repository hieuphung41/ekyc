import express from 'express';
import {
  getUsageMetrics,
  getEndpointUsage,
  getUsageSummary
} from '../controllers/apiUsageController.js';
import { protect } from '../middlewares/auth.js';

const router = express.Router();

// All routes are protected
router.use(protect);

// API usage routes
router.get('/metrics', getUsageMetrics);
router.get('/endpoint/:endpoint', getEndpointUsage);
router.get('/summary', getUsageSummary);

export default router; 
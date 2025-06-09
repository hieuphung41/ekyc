import express from 'express';
import {
  registerWebhook,
  updateWebhook,
  deleteWebhook,
  getWebhooks,
  testWebhook,
  getWebhookLogs
} from '../controllers/webhookController.js';
import { protect } from '../middlewares/auth.js';

const router = express.Router();

// All routes are protected
router.use(protect);

// Webhook management routes
router.post('/', registerWebhook);
router.put('/:webhookId', updateWebhook);
router.delete('/:webhookId', deleteWebhook);
router.get('/', getWebhooks);
router.post('/:webhookId/test', testWebhook);
router.get('/:webhookId/logs', getWebhookLogs);

export default router; 
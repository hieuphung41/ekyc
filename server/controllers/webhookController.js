import Webhook from '../models/Webhook.js';
import axios from 'axios';
import crypto from 'crypto';

// Register a new webhook for an API client
export const registerWebhook = async (req, res) => {
  try {
    const { url, events } = req.body;
    const clientId = req.user.clientId; // Assuming client ID is available in req.user

    // Create new webhook
    const webhook = new Webhook({
      clientId,
      url,
      events,
      secret: crypto.randomBytes(32).toString('hex')
    });

    await webhook.save();

    res.status(201).json({
      success: true,
      data: webhook
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Update an existing webhook
export const updateWebhook = async (req, res) => {
  try {
    const { webhookId } = req.params;
    const { url, events, status } = req.body;
    const clientId = req.user.clientId;

    const webhook = await Webhook.findOne({ _id: webhookId, clientId });
    if (!webhook) {
      return res.status(404).json({
        success: false,
        message: 'Webhook not found'
      });
    }

    // Update webhook fields
    if (url) webhook.url = url;
    if (events) webhook.events = events;
    if (status) webhook.status = status;

    await webhook.save();

    res.json({
      success: true,
      data: webhook
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Delete a webhook
export const deleteWebhook = async (req, res) => {
  try {
    const { webhookId } = req.params;
    const clientId = req.user.clientId;

    const webhook = await Webhook.findOneAndDelete({ _id: webhookId, clientId });
    if (!webhook) {
      return res.status(404).json({
        success: false,
        message: 'Webhook not found'
      });
    }

    res.json({
      success: true,
      message: 'Webhook deleted successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Get all webhooks for a client
export const getWebhooks = async (req, res) => {
  try {
    const clientId = req.user.clientId;
    const webhooks = await Webhook.find({ clientId });

    res.json({
      success: true,
      data: webhooks
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Test a webhook
export const testWebhook = async (req, res) => {
  try {
    const { webhookId } = req.params;
    const clientId = req.user.clientId;

    const webhook = await Webhook.findOne({ _id: webhookId, clientId });
    if (!webhook) {
      return res.status(404).json({
        success: false,
        message: 'Webhook not found'
      });
    }

    // Create test payload
    const testPayload = {
      event: 'test',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook'
      }
    };

    // Send test webhook
    const result = await sendWebhook(webhook, testPayload);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Get webhook delivery logs
export const getWebhookLogs = async (req, res) => {
  try {
    const { webhookId } = req.params;
    const clientId = req.user.clientId;

    const webhook = await Webhook.findOne({ _id: webhookId, clientId });
    if (!webhook) {
      return res.status(404).json({
        success: false,
        message: 'Webhook not found'
      });
    }

    res.json({
      success: true,
      data: webhook.deliveries
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Helper function to send webhook
const sendWebhook = async (webhook, payload) => {
  try {
    // Create signature
    const hmac = crypto.createHmac('sha256', webhook.secret);
    const signature = hmac.update(JSON.stringify(payload)).digest('hex');

    // Send webhook
    const response = await axios.post(webhook.url, payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature
      }
    });

    // Create delivery log
    const delivery = {
      status: 'success',
      responseCode: response.status,
      responseBody: response.data,
      deliveredAt: new Date()
    };

    webhook.deliveries.push(delivery);
    await webhook.save();

    return delivery;
  } catch (error) {
    // Create failed delivery log
    const delivery = {
      status: 'failed',
      error: error.message,
      attemptCount: 1,
      nextRetryAt: new Date(Date.now() + 5 * 60 * 1000) // Retry in 5 minutes
    };

    webhook.deliveries.push(delivery);
    await webhook.save();

    throw error;
  }
}; 
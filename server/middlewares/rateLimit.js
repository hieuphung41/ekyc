import APIClient from '../models/APIClient.js';
import { RateLimiterMongo } from 'rate-limiter-flexible';
import mongoose from 'mongoose';
import ApiUsage from '../models/ApiUsage.js';

// Create rate limiter for per-minute limits
const minuteLimiter = new RateLimiterMongo({
  storeClient: mongoose.connection,
  points: 60, // Number of points
  duration: 60, // Per minute
  blockDuration: 60, // Block for 1 minute if consumed
  keyPrefix: 'minute'
});

// Create rate limiter for per-hour limits
const hourLimiter = new RateLimiterMongo({
  storeClient: mongoose.connection,
  points: 1000, // Number of points
  duration: 3600, // Per hour
  blockDuration: 3600, // Block for 1 hour if consumed
  keyPrefix: 'hour'
});

// Create rate limiter for per-day limits
const dayLimiter = new RateLimiterMongo({
  storeClient: mongoose.connection,
  points: 10000, // Number of points
  duration: 86400, // Per day
  blockDuration: 86400, // Block for 1 day if consumed
  keyPrefix: 'day'
});

// Helper function to track API usage
const trackApiUsage = async (clientId, req, res, startTime) => {
  try {
    const responseTime = Date.now() - startTime;
    const requestSize = req.headers['content-length'] || 0;
    const responseSize = res.getHeader('content-length') || 0;

    await ApiUsage.create({
      clientId,
      endpoint: req.path,
      method: req.method,
      statusCode: res.statusCode,
      responseTime,
      requestSize,
      responseSize,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error tracking API usage:', error);
  }
};

// Rate limit middleware
export const rateLimit = async (req, res, next) => {
  const startTime = Date.now();
  
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        message: 'API key is required'
      });
    }

    // Find API client
    const client = await APIClient.findOne({ 'apiKeys.key': apiKey });
    if (!client) {
      return res.status(401).json({
        success: false,
        message: 'Invalid API key'
      });
    }

    // Get client's rate limits
    const { requestsPerMinute, requestsPerHour, requestsPerDay } = client.rateLimits;

    // Create client-specific limiters
    const clientMinuteLimiter = new RateLimiterMongo({
      storeClient: mongoose.connection,
      points: requestsPerMinute,
      duration: 60,
      blockDuration: 60,
      keyPrefix: `minute_${client._id}`
    });

    const clientHourLimiter = new RateLimiterMongo({
      storeClient: mongoose.connection,
      points: requestsPerHour,
      duration: 3600,
      blockDuration: 3600,
      keyPrefix: `hour_${client._id}`
    });

    const clientDayLimiter = new RateLimiterMongo({
      storeClient: mongoose.connection,
      points: requestsPerDay,
      duration: 86400,
      blockDuration: 86400,
      keyPrefix: `day_${client._id}`
    });

    // Create IP-specific limiters (stricter than client limits)
    const ipMinuteLimiter = new RateLimiterMongo({
      storeClient: mongoose.connection,
      points: Math.min(requestsPerMinute, 30), // Max 30 requests per minute per IP
      duration: 60,
      blockDuration: 60,
      keyPrefix: `minute_ip_${req.ip}`
    });

    const ipHourLimiter = new RateLimiterMongo({
      storeClient: mongoose.connection,
      points: Math.min(requestsPerHour, 500), // Max 500 requests per hour per IP
      duration: 3600,
      blockDuration: 3600,
      keyPrefix: `hour_ip_${req.ip}`
    });

    const ipDayLimiter = new RateLimiterMongo({
      storeClient: mongoose.connection,
      points: Math.min(requestsPerDay, 5000), // Max 5000 requests per day per IP
      duration: 86400,
      blockDuration: 86400,
      keyPrefix: `day_ip_${req.ip}`
    });

    // Check all rate limits
    const [clientMinuteRes, clientHourRes, clientDayRes,
           ipMinuteRes, ipHourRes, ipDayRes] = await Promise.all([
      clientMinuteLimiter.consume(client._id.toString()),
      clientHourLimiter.consume(client._id.toString()),
      clientDayLimiter.consume(client._id.toString()),
      ipMinuteLimiter.consume(req.ip),
      ipHourLimiter.consume(req.ip),
      ipDayLimiter.consume(req.ip)
    ]);

    // Add rate limit headers
    res.set({
      'X-RateLimit-Minute-Limit': requestsPerMinute,
      'X-RateLimit-Minute-Remaining': Math.min(clientMinuteRes.remainingPoints, ipMinuteRes.remainingPoints),
      'X-RateLimit-Minute-Reset': new Date(Date.now() + Math.max(clientMinuteRes.msBeforeNext, ipMinuteRes.msBeforeNext)),
      'X-RateLimit-Hour-Limit': requestsPerHour,
      'X-RateLimit-Hour-Remaining': Math.min(clientHourRes.remainingPoints, ipHourRes.remainingPoints),
      'X-RateLimit-Hour-Reset': new Date(Date.now() + Math.max(clientHourRes.msBeforeNext, ipHourRes.msBeforeNext)),
      'X-RateLimit-Day-Limit': requestsPerDay,
      'X-RateLimit-Day-Remaining': Math.min(clientDayRes.remainingPoints, ipDayRes.remainingPoints),
      'X-RateLimit-Day-Reset': new Date(Date.now() + Math.max(clientDayRes.msBeforeNext, ipDayRes.msBeforeNext))
    });

    // Track API usage after response
    res.on('finish', () => {
      trackApiUsage(client._id, req, res, startTime);
    });

    next();
  } catch (error) {
    if (error.name === 'RateLimiterError') {
      return res.status(429).json({
        success: false,
        message: 'Rate limit exceeded',
        retryAfter: error.msBeforeNext / 1000
      });
    }
    console.error('Rate limit error:', error);
    next(error);
  }
}; 
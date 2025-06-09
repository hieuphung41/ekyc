import ApiUsage from '../models/ApiUsage.js';

// Track API usage
export const trackApiUsage = async (req, res, next) => {
  const startTime = Date.now();
  const originalSend = res.send;

  // Override res.send to capture response data
  res.send = function(data) {
    const responseTime = Date.now() - startTime;
    const requestSize = JSON.stringify(req.body).length;
    const responseSize = JSON.stringify(data).length;

    // Create usage record
    const usage = new ApiUsage({
      clientId: req.user.clientId,
      endpoint: req.path,
      method: req.method,
      statusCode: res.statusCode,
      responseTime,
      requestSize,
      responseSize,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    // Save usage record asynchronously
    usage.save().catch(err => console.error('Error saving API usage:', err));

    // Call original send
    originalSend.call(this, data);
  };

  next();
};

// Get usage metrics
export const getUsageMetrics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const clientId = req.user.clientId;

    const timeRange = {
      startDate: new Date(startDate),
      endDate: new Date(endDate)
    };

    const metrics = await ApiUsage.getUsageMetrics(clientId, timeRange);

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Get endpoint usage
export const getEndpointUsage = async (req, res) => {
  try {
    const { endpoint } = req.params;
    const { startDate, endDate } = req.query;
    const clientId = req.user.clientId;

    const timeRange = {
      startDate: new Date(startDate),
      endDate: new Date(endDate)
    };

    const usage = await ApiUsage.getEndpointUsage(clientId, endpoint, timeRange);

    res.json({
      success: true,
      data: usage
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Get usage summary
export const getUsageSummary = async (req, res) => {
  try {
    const clientId = req.user.clientId;
    const { startDate, endDate } = req.query;

    const timeRange = {
      startDate: new Date(startDate),
      endDate: new Date(endDate)
    };

    // Get total requests
    const totalRequests = await ApiUsage.countDocuments({
      clientId,
      timestamp: {
        $gte: timeRange.startDate,
        $lte: timeRange.endDate
      }
    });

    // Get success rate
    const successCount = await ApiUsage.countDocuments({
      clientId,
      timestamp: {
        $gte: timeRange.startDate,
        $lte: timeRange.endDate
      },
      statusCode: { $lt: 400 }
    });

    // Get average response time
    const avgResponseTime = await ApiUsage.aggregate([
      {
        $match: {
          clientId: mongoose.Types.ObjectId(clientId),
          timestamp: {
            $gte: timeRange.startDate,
            $lte: timeRange.endDate
          }
        }
      },
      {
        $group: {
          _id: null,
          avgResponseTime: { $avg: '$responseTime' }
        }
      }
    ]);

    // Get top endpoints
    const topEndpoints = await ApiUsage.aggregate([
      {
        $match: {
          clientId: mongoose.Types.ObjectId(clientId),
          timestamp: {
            $gte: timeRange.startDate,
            $lte: timeRange.endDate
          }
        }
      },
      {
        $group: {
          _id: '$endpoint',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 5
      }
    ]);

    res.json({
      success: true,
      data: {
        totalRequests,
        successRate: (successCount / totalRequests) * 100,
        avgResponseTime: avgResponseTime[0]?.avgResponseTime || 0,
        topEndpoints
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}; 
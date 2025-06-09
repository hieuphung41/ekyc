import mongoose from 'mongoose';

const apiUsageSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'APIClient',
    required: true
  },
  endpoint: {
    type: String,
    required: true
  },
  method: {
    type: String,
    enum: ['GET', 'POST', 'PUT', 'DELETE'],
    required: true
  },
  statusCode: {
    type: Number,
    required: true
  },
  responseTime: {
    type: Number, // in milliseconds
    required: true
  },
  requestSize: {
    type: Number, // in bytes
    required: true
  },
  responseSize: {
    type: Number, // in bytes
    required: true
  },
  ipAddress: {
    type: String,
    required: true
  },
  userAgent: String,
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
apiUsageSchema.index({ clientId: 1, timestamp: -1 });
apiUsageSchema.index({ endpoint: 1, timestamp: -1 });
apiUsageSchema.index({ statusCode: 1, timestamp: -1 });

// Static method to get usage metrics
apiUsageSchema.statics.getUsageMetrics = async function(clientId, timeRange) {
  const { startDate, endDate } = timeRange;
  
  const metrics = await this.aggregate([
    {
      $match: {
        clientId: mongoose.Types.ObjectId(clientId),
        timestamp: {
          $gte: startDate,
          $lte: endDate
        }
      }
    },
    {
      $group: {
        _id: {
          endpoint: '$endpoint',
          date: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$timestamp'
            }
          }
        },
        totalRequests: { $sum: 1 },
        avgResponseTime: { $avg: '$responseTime' },
        totalRequestSize: { $sum: '$requestSize' },
        totalResponseSize: { $sum: '$responseSize' },
        successCount: {
          $sum: {
            $cond: [{ $lt: ['$statusCode', 400] }, 1, 0]
          }
        },
        errorCount: {
          $sum: {
            $cond: [{ $gte: ['$statusCode', 400] }, 1, 0]
          }
        }
      }
    },
    {
      $sort: {
        '_id.date': 1,
        '_id.endpoint': 1
      }
    }
  ]);

  return metrics;
};

// Static method to get endpoint usage
apiUsageSchema.statics.getEndpointUsage = async function(clientId, endpoint, timeRange) {
  const { startDate, endDate } = timeRange;
  
  const usage = await this.aggregate([
    {
      $match: {
        clientId: mongoose.Types.ObjectId(clientId),
        endpoint,
        timestamp: {
          $gte: startDate,
          $lte: endDate
        }
      }
    },
    {
      $group: {
        _id: {
          date: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$timestamp'
            }
          }
        },
        totalRequests: { $sum: 1 },
        avgResponseTime: { $avg: '$responseTime' },
        totalRequestSize: { $sum: '$requestSize' },
        totalResponseSize: { $sum: '$responseSize' },
        successCount: {
          $sum: {
            $cond: [{ $lt: ['$statusCode', 400] }, 1, 0]
          }
        },
        errorCount: {
          $sum: {
            $cond: [{ $gte: ['$statusCode', 400] }, 1, 0]
          }
        }
      }
    },
    {
      $sort: {
        '_id.date': 1
      }
    }
  ]);

  return usage;
};

export default mongoose.model('ApiUsage', apiUsageSchema); 
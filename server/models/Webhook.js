import mongoose from 'mongoose';

// Schema for webhook delivery logs
const webhookDeliverySchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['pending', 'success', 'failed'],
    default: 'pending'
  },
  responseCode: Number,
  responseBody: String,
  error: String,
  attemptCount: {
    type: Number,
    default: 0
  },
  nextRetryAt: Date,
  deliveredAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Schema for webhook configuration
const webhookSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'APIClient',
    required: true
  },
  url: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return /^https?:\/\/.+/.test(v);
      },
      message: props => `${props.value} is not a valid URL!`
    }
  },
  events: [{
    type: String,
    enum: [
      'kyc.status_change',
      'kyc.verification_complete',
      'kyc.verification_failed',
      'rate_limit.exceeded',
      'usage.threshold_reached'
    ],
    required: true
  }],
  secret: {
    type: String,
    required: true,
    default: () => crypto.randomBytes(32).toString('hex')
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  deliveries: [webhookDeliverySchema],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Update timestamp before saving
webhookSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Method to validate webhook signature
webhookSchema.methods.validateSignature = function(payload, signature) {
  const hmac = crypto.createHmac('sha256', this.secret);
  const calculatedSignature = hmac.update(JSON.stringify(payload)).digest('hex');
  return calculatedSignature === signature;
};

export default mongoose.model('Webhook', webhookSchema); 
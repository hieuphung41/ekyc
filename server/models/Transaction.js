import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  transactionId: {
    type: String,
    required: true,
    unique: true,
  },
  type: {
    type: String,
    enum: ["payment", "transfer", "withdrawal", "deposit", "other"],
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    default: "USD",
  },
  status: {
    type: String,
    enum: ["pending", "approved", "expired"],
    default: "pending",
  },
  verificationMethod: {
    type: String,
    enum: ["face", "voice", "both", "none"],
    default: "none",
  },
  verificationData: {
    faceVerification: {
      verified: {
        type: Boolean,
        default: false,
      },
      confidence: Number,
      timestamp: Date,
      imageUrl: String,
    },
    voiceVerification: {
      verified: {
        type: Boolean,
        default: false,
      },
      confidence: Number,
      timestamp: Date,
      audioUrl: String,
    },
  },
  metadata: {
    ipAddress: String,
    deviceInfo: String,
    location: {
      country: String,
      city: String,
      coordinates: {
        latitude: Number,
        longitude: Number,
      },
    },
  },
  riskScore: {
    type: Number,
    default: 0,
  },
  verificationHistory: [
    {
      timestamp: {
        type: Date,
        default: Date.now,
      },
      action: String,
      status: String,
      method: String,
      confidence: Number,
      notes: String,
    },
  ],
  expiryTime: {
    type: Date,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update the updatedAt timestamp before saving
transactionSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Method to check if transaction is expired
transactionSchema.methods.isExpired = function () {
  return new Date() > this.expiryTime;
};

// Method to calculate risk score
transactionSchema.methods.calculateRiskScore = function () {
  let score = 0;
  
  // Check verification methods
  if (this.verificationMethod === "both") {
    score += 40;
  } else if (this.verificationMethod === "face" || this.verificationMethod === "voice") {
    score += 20;
  }

  // Check verification confidence
  if (this.verificationData.faceVerification?.confidence > 0.8) {
    score += 20;
  }
  if (this.verificationData.voiceVerification?.confidence > 0.8) {
    score += 20;
  }

  // Check amount risk
  if (this.amount > 10000) {
    score -= 10;
  }

  // Check location risk (if available)
  if (this.metadata.location) {
    // Add location-based risk calculation here
    // Example: Check if location matches user's usual locations
  }

  this.riskScore = Math.max(0, Math.min(100, score));
  return this.riskScore;
};

// Method to verify transaction
transactionSchema.methods.verify = async function (verificationMethod, verificationData) {
  const timestamp = new Date();

  // Update verification data
  if (verificationMethod === "face" || verificationMethod === "both") {
    this.verificationData.faceVerification = {
      verified: true,
      confidence: verificationData.faceConfidence,
      timestamp,
      imageUrl: verificationData.faceImageUrl,
    };
  }

  if (verificationMethod === "voice" || verificationMethod === "both") {
    this.verificationData.voiceVerification = {
      verified: true,
      confidence: verificationData.voiceConfidence,
      timestamp,
      audioUrl: verificationData.voiceAudioUrl,
    };
  }

  // Add to verification history
  this.verificationHistory.push({
    timestamp,
    action: "verification",
    status: "success",
    method: verificationMethod,
    confidence: verificationData.confidence,
    notes: "Transaction verified successfully",
  });

  // Calculate new risk score
  this.calculateRiskScore();

  // Update status based on risk score
  if (this.riskScore >= 70) {
    this.status = "verified";
  } else if (this.riskScore >= 40) {
    this.status = "pending";
  } else {
    this.status = "rejected";
  }

  await this.save();
  return this;
};

// Add pre-save middleware to update status
transactionSchema.pre('save', function(next) {
  // Check if transaction is expired
  if (this.isExpired()) {
    this.status = 'expired';
    return next();
  }

  // If transaction is already approved or expired, don't change status
  if (this.status === 'approved' || this.status === 'expired') {
    return next();
  }

  // Check verification status based on verification method
  if (this.verificationMethod === 'both') {
    if (this.verificationData?.face?.verified && 
        this.verificationData?.voice?.verified) {
      this.status = 'approved';
    }
  } else if (this.verificationMethod === 'face' && 
             this.verificationData?.face?.verified) {
    this.status = 'approved';
  } else if (this.verificationMethod === 'voice' && 
             this.verificationData?.voice?.verified) {
    this.status = 'approved';
  }

  next();
});

export default mongoose.model("Transaction", transactionSchema); 
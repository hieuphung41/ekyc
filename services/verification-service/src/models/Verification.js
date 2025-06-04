import mongoose from 'mongoose';

const verificationSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'expired'],
    default: 'pending'
  },
  verificationType: {
    type: String,
    enum: ['kyc', 'biometric', 'document', 'video', 'voice'],
    required: true
  },
  completedSteps: {
    faceVerification: {
      completed: {
        type: Boolean,
        default: false
      },
      completedAt: Date,
      attempts: {
        type: Number,
        default: 0
      }
    },
    documentVerification: {
      completed: {
        type: Boolean,
        default: false
      },
      completedAt: Date,
      attempts: {
        type: Number,
        default: 0
      }
    },
    videoVerification: {
      completed: {
        type: Boolean,
        default: false
      },
      completedAt: Date,
      attempts: {
        type: Number,
        default: 0
      }
    },
    voiceVerification: {
      completed: {
        type: Boolean,
        default: false
      },
      completedAt: Date,
      attempts: {
        type: Number,
        default: 0
      }
    }
  },
  verificationData: {
    faceData: {
      imageUrl: String,
      verificationStatus: {
        type: String,
        enum: ['pending', 'verified', 'rejected'],
        default: 'pending'
      },
      confidence: Number,
      livenessScore: Number,
      uploadedAt: Date
    },
    documentData: {
      documentType: {
        type: String,
        enum: ['nationalId', 'passport', 'drivingLicense']
      },
      documentNumber: String,
      frontImageUrl: String,
      backImageUrl: String,
      verificationStatus: {
        type: String,
        enum: ['pending', 'verified', 'rejected'],
        default: 'pending'
      },
      ocrData: {
        extractedFields: mongoose.Schema.Types.Mixed,
        confidence: Number,
        processedAt: Date
      }
    },
    videoData: {
      videoUrl: String,
      verificationStatus: {
        type: String,
        enum: ['pending', 'verified', 'rejected'],
        default: 'pending'
      },
      livenessScore: Number,
      faceMatchScore: Number,
      uploadedAt: Date
    },
    voiceData: {
      audioUrl: String,
      verificationStatus: {
        type: String,
        enum: ['pending', 'verified', 'rejected'],
        default: 'pending'
      },
      confidence: Number,
      livenessScore: Number,
      uploadedAt: Date
    }
  },
  verificationHistory: [{
    timestamp: {
      type: Date,
      default: Date.now
    },
    action: String,
    status: String,
    notes: String,
    performedBy: String
  }],
  expiryDate: {
    type: Date,
    required: true
  },
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

// Indexes
verificationSchema.index({ userId: 1, verificationType: 1 });
verificationSchema.index({ 'verificationData.documentData.documentNumber': 1 }, { unique: true, sparse: true });

// Pre-save middleware
verificationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();

  // Check if all steps are completed
  const allStepsCompleted = 
    this.completedSteps.faceVerification?.completed &&
    this.completedSteps.documentVerification?.completed &&
    this.completedSteps.videoVerification?.completed &&
    this.completedSteps.voiceVerification?.completed;

  // If all steps are completed and status is pending, update to approved
  if (allStepsCompleted && this.status === 'pending') {
    this.status = 'approved';
    
    // Add to verification history
    this.verificationHistory.push({
      action: 'auto_approval',
      status: 'approved',
      notes: 'All verification steps completed successfully',
      timestamp: new Date()
    });
  }

  next();
});

// Methods
verificationSchema.methods.isExpired = function() {
  return new Date() > this.expiryDate;
};

verificationSchema.methods.isValid = function() {
  return this.status === 'approved' && !this.isExpired();
};

verificationSchema.methods.getNextIncompleteStep = function() {
  if (!this.completedSteps.faceVerification.completed) return 1;
  if (!this.completedSteps.documentVerification.completed) return 2;
  if (!this.completedSteps.videoVerification.completed) return 3;
  if (!this.completedSteps.voiceVerification.completed) return 4;
  return 5; // All steps completed
};

const Verification = mongoose.model('Verification', verificationSchema);

export default Verification; 
import mongoose from "mongoose";

const kycSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected", "expired"],
    default: "pending",
  },
  completedSteps: {
    faceVerification: {
      completed: {
        type: Boolean,
        default: false,
      },
      completedAt: Date,
      attempts: {
        type: Number,
        default: 0,
      },
    },
    documentVerification: {
      completed: {
        type: Boolean,
        default: false,
      },
      completedAt: Date,
      attempts: {
        type: Number,
        default: 0,
      },
    },
    videoVerification: {
      completed: {
        type: Boolean,
        default: false,
      },
      completedAt: Date,
      attempts: {
        type: Number,
        default: 0,
      },
    },
  },
  personalInfo: {
    dateOfBirth: Date,
    nationality: String,
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      postalCode: String,
    },
  },
  documents: [
    {
      type: {
        type: String,
        enum: ["passport", "nationalId", "drivingLicense"],
        required: true,
      },
      documentNumber: String,
      issuingCountry: String,
      issueDate: Date,
      expiryDate: Date,
      frontImageUrl: String,
      backImageUrl: String,
      verificationStatus: {
        type: String,
        enum: ["pending", "verified", "rejected"],
        default: "pending",
      },
      ocrData: {
        extractedFields: mongoose.Schema.Types.Mixed,
        confidence: Number,
        processedAt: Date,
      },
    },
  ],
  biometricData: {
    faceData: {
      imageUrl: String,
      verificationStatus: {
        type: String,
        enum: ["pending", "verified", "rejected"],
        default: "pending",
      },
      confidence: Number,
      livenessScore: Number,
      uploadedAt: Date,
      fileType: String,
      fileSize: Number,
    },
    voiceData: {
      audioUrl: String,
      verificationStatus: {
        type: String,
        enum: ["pending", "verified", "rejected"],
        default: "pending",
      },
      confidence: Number,
      livenessScore: Number,
      uploadedAt: Date,
      fileType: String,
      fileSize: Number,
      duration: Number,
      sampleRate: Number,
      channels: Number,
    },
    videoData: {
      videoUrl: String,
      verificationStatus: {
        type: String,
        enum: ["pending", "verified", "rejected"],
        default: "pending",
      },
      confidence: Number,
      livenessScore: Number,
      faceMatchScore: Number,
      uploadedAt: Date,
      fileType: String,
      fileSize: Number,
      actionSequence: [String],
      completed: Boolean,
    },
  },
  verificationHistory: [
    {
      timestamp: {
        type: Date,
        default: Date.now,
      },
      action: String,
      status: String,
      notes: String,
      performedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    },
  ],
  livenessCheck: {
    status: {
      type: String,
      enum: ["pending", "passed", "failed"],
      default: "pending",
    },
    timestamp: Date,
    score: Number,
    actionSequence: [String],
    challengeId: String,
  },
  expiryDate: {
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
kycSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Method to check if KYC is expired
kycSchema.methods.isExpired = function () {
  return new Date() > this.expiryDate;
};

// Method to check if KYC is valid
kycSchema.methods.isValid = function () {
  return this.status === "approved" && !this.isExpired();
};

// Method to get the next incomplete step
kycSchema.methods.getNextIncompleteStep = function () {
  if (!this.completedSteps.faceVerification.completed) {
    return 1;
  }
  if (!this.completedSteps.documentVerification.completed) {
    return 2;
  }
  if (!this.completedSteps.videoVerification.completed) {
    return 3;
  }
  return 4; // All steps completed
};

export default mongoose.model("KYC", kycSchema);

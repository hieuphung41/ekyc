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
    },
    voiceData: {
      audioUrl: String,
      verificationStatus: {
        type: String,
        enum: ["pending", "verified", "rejected"],
        default: "pending",
      },
      confidence: Number,
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

export default mongoose.model("KYC", kycSchema);

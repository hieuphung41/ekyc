import mongoose from "mongoose";
import crypto from "crypto";
import bcrypt from "bcryptjs";

const apiClientSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  clientId: {
    type: String,
    unique: true,
    required: true,
    default: () => crypto.randomBytes(16).toString("hex"),
  },
  clientSecret: {
    type: String,
    required: true,
    default: () => crypto.randomBytes(32).toString("hex"),
  },
  organization: {
    name: String,
    address: String,
    registrationNumber: String,
    website: String,
  },
  contactPerson: {
    name: String,
    email: String,
    phone: String,
  },
  representative: {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    phoneNumber: {
      type: String,
      trim: true,
    }
  },
  permissions: [
    {
      type: String,
      enum: [
        "register", 
        "verify", 
        "query",
        "ekyc_register",
        "ekyc_verify",
        "ekyc_query",
        "ekyc_face_verify",
        "ekyc_voice_verify",
        "ekyc_document_verify"
      ],
      required: true,
    },
  ],
  status: {
    type: String,
    enum: ["active", "inactive", "suspended"],
    default: "active",
  },
  ekycConfig: {
    allowedVerificationMethods: {
      face: { type: Boolean, default: false },
      voice: { type: Boolean, default: false },
      document: { type: Boolean, default: false }
    },
    maxVerificationAttempts: { type: Number, default: 3 },
    verificationTimeout: { type: Number, default: 300 }, // in seconds
    allowedDocumentTypes: [{
      type: String,
      enum: ["id_card", "passport", "driver_license"]
    }]
  },
  ipWhitelist: [
    {
      type: String,
      validate: {
        validator: function (v) {
          return /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(
            v
          );
        },
        message: (props) => `${props.value} is not a valid IP address!`,
      },
    },
  ],
  rateLimits: {
    requestsPerMinute: {
      type: Number,
      default: 60,
    },
    requestsPerHour: {
      type: Number,
      default: 1000,
    },
    requestsPerDay: {
      type: Number,
      default: 10000,
    },
  },
  webhookUrl: {
    type: String,
    validate: {
      validator: function (v) {
        return /^https?:\/\/.+/.test(v);
      },
      message: (props) => `${props.value} is not a valid URL!`,
    },
  },
  apiKey: {
    type: String,
    unique: true,
    sparse: true,
    default: () => crypto.randomBytes(32).toString("hex"),
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

// Update timestamp before saving
apiClientSchema.pre("save", async function (next) {
  this.updatedAt = Date.now();
  
  // Hash password if it's modified
  if (this.representative && this.isModified('representative.password')) {
    try {
      const salt = await bcrypt.genSalt(10);
      this.representative.password = await bcrypt.hash(this.representative.password, salt);
    } catch (error) {
      return next(error);
    }
  }
  
  next();
});

// Method to validate client credentials
apiClientSchema.methods.validateCredentials = function (
  clientId,
  clientSecret
) {
  return this.clientId === clientId && this.clientSecret === clientSecret;
};

// Method to validate representative credentials
apiClientSchema.methods.validateRepresentativeCredentials = async function (
  email,
  password
) {
  if (this.representative.email !== email) return false;
  return bcrypt.compare(password, this.representative.password);
};

// Method to check if IP is whitelisted
apiClientSchema.methods.isIPWhitelisted = function (ip) {
  return this.ipWhitelist.length === 0 || this.ipWhitelist.includes(ip);
};

// Method to generate new API key
apiClientSchema.methods.generateNewApiKey = function () {
  this.apiKey = crypto.randomBytes(32).toString("hex");
  return this.apiKey;
};

export default mongoose.model("APIClient", apiClientSchema);

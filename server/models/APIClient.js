import mongoose from "mongoose";
import crypto from "crypto";

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
  permissions: [
    {
      type: String,
      enum: ["register", "verify", "query"],
      required: true,
    },
  ],
  status: {
    type: String,
    enum: ["active", "inactive", "suspended"],
    default: "active",
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
apiClientSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Method to validate client credentials
apiClientSchema.methods.validateCredentials = function (
  clientId,
  clientSecret
) {
  return this.clientId === clientId && this.clientSecret === clientSecret;
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

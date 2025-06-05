import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema({
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
  role: {
    type: String,
    enum: ["user", "admin"],
    default: "user",
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
  },
  apiKey: {
    type: String,
    sparse: true,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  registeredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "APIClient",
    required: true,
  },
  status: {
    type: String,
    enum: ["active", "inactive", "suspended", "pending"],
    default: "pending",
  },
  clientMetadata: {
    clientReferenceId: String,
    relationshipType: String,
    registrationDate: {
      type: Date,
      default: Date.now,
    },
    lastActivityDate: Date,
    customFields: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: new Map(),
    },
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

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model("User", userSchema);

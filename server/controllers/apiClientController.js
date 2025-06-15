import APIClient from "../models/APIClient.js";
import Webhook from "../models/Webhook.js";
import { generateToken } from "../utils/jwt.js";
import crypto from "crypto";
import User from "../models/User.js";
import ApiUsage from "../models/ApiUsage.js";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

// @desc    Register new API client with representative
// @route   POST /api/clients/register
// @access  Public
export const registerClient = async (req, res) => {
  try {
    const {
      name,
      organization,
      contactPerson,
      permissions,
      ipWhitelist,
      rateLimits,
      ekycConfig,
      representative,
      subscription,
    } = req.body;

    // Check if representative email already exists
    const existingClient = await APIClient.findOne({
      "representative.email": representative.email,
    });
    if (existingClient) {
      return res.status(400).json({
        success: false,
        message: "Representative email already registered",
      });
    }

    // Validate eKYC permissions
    const ekycPermissions = permissions.filter((p) => p.startsWith("ekyc_"));
    if (ekycPermissions.length > 0) {
      if (!ekycConfig) {
        return res.status(400).json({
          success: false,
          message:
            "eKYC configuration is required when requesting eKYC permissions",
        });
      }

      if (
        ekycPermissions.includes("ekyc_face_verify") &&
        !ekycConfig.allowedVerificationMethods.face
      ) {
        return res.status(400).json({
          success: false,
          message: "Face verification method must be enabled in eKYC config",
        });
      }
      if (
        ekycPermissions.includes("ekyc_voice_verify") &&
        !ekycConfig.allowedVerificationMethods.voice
      ) {
        return res.status(400).json({
          success: false,
          message: "Voice verification method must be enabled in ekycConfig",
        });
      }
      if (
        ekycPermissions.includes("ekyc_document_verify") &&
        !ekycConfig.allowedVerificationMethods.document
      ) {
        return res.status(400).json({
          success: false,
          message: "Document verification method must be enabled in ekycConfig",
        });
      }
    }

    const client = await APIClient.create({
      name,
      organization,
      contactPerson,
      permissions,
      ipWhitelist,
      rateLimits,
      ekycConfig,
      representative,
      subscription: subscription || {
        tier: "free",
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        features: {
          maxWebhooks: 1,
          maxApiKeys: 2,
          maxUsers: 1,
        },
      },
    });

    res.status(201).json({
      success: true,
      data: {
        id: client._id,
        name: client.name,
        clientId: client.clientId,
        clientSecret: client.clientSecret,
        apiKey: client.apiKey,
        permissions: client.permissions,
        status: client.status,
        ekycConfig: client.ekycConfig,
        subscription: client.subscription,
        representative: {
          email: client.representative.email,
          firstName: client.representative.firstName,
          lastName: client.representative.lastName,
          phoneNumber: client.representative.phoneNumber,
        },
      },
    });
  } catch (error) {
    console.error("API client registration error:", error);
    res.status(500).json({
      success: false,
      message: "Error registering API client",
    });
  }
};

// @desc    Login API client
// @route   POST /api/clients/login
// @access  Public
export const loginRepresentative = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find client by representative email
    const client = await APIClient.findOne({ "representative.email": email });
    if (!client) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(
      password,
      client.representative.password
    );
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Check if client is active
    if (client.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "Account is not active",
      });
    }

    // Generate token with correct payload structure
    const token = generateToken({
      id: client._id,
      email: client.representative.email,
      role: "api-client",
      clientId: client.clientId,
      permissions: client.permissions,
    });

    // Set HTTP-only cookie with proper configuration
    res.cookie("auth_token_apiclient", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: "/", // Ensure cookie is available for all paths
    });

    // Update last login
    client.lastLogin = new Date();
    await client.save();

    res.json({
      success: true,
      data: {
        token,
        client: {
          id: client._id,
          name: client.name,
          organization: client.organization,
          permissions: client.permissions,
          status: client.status,
          subscription: client.subscription,
          settings: client.settings,
        },
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Error during login",
    });
  }
};

// @desc    Authenticate API client (for API access)
// @route   POST /api/clients/auth
// @access  Public
export const authenticateClient = async (req, res) => {
  try {
    const { clientId, clientSecret } = req.body;

    const client = await APIClient.findOne({ clientId });
    if (!client || !client.validateCredentials(clientId, clientSecret)) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    if (client.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "API client is not active",
      });
    }

    const token = generateToken({
      id: client._id,
      role: "api-client",
      clientId: client.clientId,
      permissions: client.permissions,
    });

    res.json({
      success: true,
      data: {
        token,
        permissions: client.permissions,
      },
    });
  } catch (error) {
    console.error("API client authentication error:", error);
    res.status(500).json({
      success: false,
      message: "Error authenticating API client",
    });
  }
};

// @desc    Get API client details
// @route   GET /api/clients/:id
// @access  Private
export const getClient = async (req, res) => {
  try {
    const client = await APIClient.findById(req.params.id);
    if (!client) {
      return res.status(404).json({
        success: false,
        message: "API client not found",
      });
    }

    res.json({
      success: true,
      data: client,
    });
  } catch (error) {
    console.error("Get API client error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching API client details",
    });
  }
};

// @desc    Update API client
// @route   PUT /api/clients/:id
// @access  Private
export const updateClient = async (req, res) => {
  try {
    const {
      name,
      organization,
      contactPerson,
      permissions,
      ipWhitelist,
      rateLimits,
      webhookUrl,
      ekycConfig,
      status,
    } = req.body;

    const client = await APIClient.findById(req.params.id);
    if (!client) {
      return res.status(404).json({
        success: false,
        message: "API client not found",
      });
    }

    // Update fields
    if (name) client.name = name;
    if (organization) client.organization = organization;
    if (contactPerson) client.contactPerson = contactPerson;
    if (permissions) client.permissions = permissions;
    if (ipWhitelist) client.ipWhitelist = ipWhitelist;
    if (rateLimits) client.rateLimits = rateLimits;
    if (webhookUrl) client.webhookUrl = webhookUrl;
    if (ekycConfig) client.ekycConfig = ekycConfig;
    if (status) client.status = status;

    await client.save();

    res.json({
      success: true,
      data: client,
    });
  } catch (error) {
    console.error("Update API client error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating API client",
    });
  }
};

// @desc    Get all API keys for the authenticated client
// @route   GET /api/clients/api-keys
// @access  Private
export const getApiKeys = async (req, res) => {
  try {
    const client = await APIClient.findById(req.apiClient._id);
    if (!client) {
      return res.status(404).json({
        success: false,
        message: "API client not found",
      });
    }

    // Return the API keys with their status and metadata
    const apiKeys = client.apiKeys.map((key) => ({
      _id: key._id,
      key: key.key,
      status: key.status,
      createdAt: key.createdAt,
      lastUsed: key.lastUsed,
      expiresAt: key.expiresAt,
    }));

    res.json({
      success: true,
      data: apiKeys,
    });
  } catch (error) {
    console.error("Get API keys error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching API keys",
    });
  }
};

// @desc    Generate new API key for the authenticated client
// @route   POST /api/clients/api-keys/generate
// @access  Private
export const generateApiKey = async (req, res) => {
  try {
    const client = await APIClient.findById(req.apiClient._id);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "API client not found",
      });
    }

    // Check subscription status
    if (!client.isSubscriptionActive()) {
      return res.status(403).json({
        success: false,
        message: "Subscription has expired",
      });
    }

    // Check API key limit
    if (client.apiKeys.length >= client.subscription.features.maxApiKeys) {
      return res.status(403).json({
        success: false,
        message:
          "Maximum number of API keys reached for this subscription tier",
      });
    }

    const apiKey = client.generateNewApiKey();
    await client.save();

    res.json({
      success: true,
      data: {
        apiKey: apiKey.key,
        expiresAt: apiKey.expiresAt,
      },
    });
  } catch (error) {
    console.error("API key generation error:", error);
    res.status(500).json({
      success: false,
      message: "Error generating API key",
    });
  }
};

// @desc    Revoke an API key
// @route   POST /api/clients/api-keys/revoke
// @access  Private
export const revokeApiKey = async (req, res) => {
  try {
    const { keyId } = req.body;

    if (!keyId) {
      return res.status(400).json({
        success: false,
        message: "API key ID is required",
      });
    }

    const client = await APIClient.findById(req.apiClient._id);
    if (!client) {
      return res.status(404).json({
        success: false,
        message: "API client not found",
      });
    }

    const apiKey = client.apiKeys.id(keyId);
    if (!apiKey) {
      return res.status(404).json({
        success: false,
        message: "API key not found",
      });
    }

    apiKey.status = "revoked";
    await client.save();

    res.json({
      success: true,
      data: {
        _id: apiKey._id,
        status: apiKey.status,
      },
    });
  } catch (error) {
    console.error("Revoke API key error:", error);
    res.status(500).json({
      success: false,
      message: "Error revoking API key",
    });
  }
};

// @desc    Regenerate an API key
// @route   POST /api/clients/api-keys/regenerate
// @access  Private
export const regenerateApiKey = async (req, res) => {
  try {
    const { keyId } = req.body;

    if (!keyId) {
      return res.status(400).json({
        success: false,
        message: "API key ID is required",
      });
    }

    const client = await APIClient.findById(req.apiClient._id);
    if (!client) {
      return res.status(404).json({
        success: false,
        message: "API client not found",
      });
    }

    const apiKey = client.apiKeys.id(keyId);
    if (!apiKey) {
      return res.status(404).json({
        success: false,
        message: "API key not found",
      });
    }

    // Generate new key and update the existing one
    const newKey = crypto.randomBytes(32).toString("hex");
    apiKey.key = newKey;
    apiKey.status = "active";
    apiKey.createdAt = new Date();
    apiKey.lastUsed = null;
    await client.save();

    res.json({
      success: true,
      data: {
        _id: apiKey._id,
        key: apiKey.key,
        status: apiKey.status,
        createdAt: apiKey.createdAt,
        expiresAt: apiKey.expiresAt,
      },
    });
  } catch (error) {
    console.error("Regenerate API key error:", error);
    res.status(500).json({
      success: false,
      message: "Error regenerating API key",
    });
  }
};

// @desc    Get all API clients
// @route   GET /api/clients
// @access  Public
export const getAllClients = async (req, res) => {
  try {
    const clients = await APIClient.find({ status: "active" }).sort({
      name: 1,
    });

    res.json({
      success: true,
      data: clients,
    });
  } catch (error) {
    console.error("Get all API clients error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching API clients",
    });
  }
};

// @desc    Check API client authentication status
// @route   GET /api/clients/check-auth
// @access  Private
export const checkClientAuthStatus = async (req, res) => {
  try {
    console.log("Checking auth status:", {
      hasApiClient: !!req.apiClient,
      clientId: req.apiClient?.clientId,
      status: req.apiClient?.status,
    });

    // If we reach this point, the protect middleware has already authenticated the API client
    // The authenticated client object is available in req.apiClient
    if (!req.apiClient) {
      console.log("No API client found in request");
      return res.status(401).json({
        success: false,
        message: "Not authorized: No API client found",
      });
    }

    // Verify the client is active
    if (req.apiClient.status !== "active") {
      console.log("API client is not active:", req.apiClient.status);
      return res.status(403).json({
        success: false,
        message: "API client account is not active",
      });
    }

    res.json({
      success: true,
      data: {
        id: req.apiClient._id,
        clientId: req.apiClient.clientId,
        name: req.apiClient.name,
        organization: req.apiClient.organization,
        permissions: req.apiClient.permissions,
        status: req.apiClient.status,
        subscription: req.apiClient.subscription,
        settings: req.apiClient.settings,
      },
    });
  } catch (error) {
    console.error("Check API client auth status error:", error);
    res.status(500).json({
      success: false,
      message: "Error checking API client authentication status",
    });
  }
};

// @desc    Logout API client
// @route   POST /api/clients/logout
// @access  Private
export const logoutClient = async (req, res) => {
  try {
    res.clearCookie("auth_token_apiclient", {
      httpOnly: true,
      secure: true, // Always true in production
      sameSite: 'none', // Changed to 'none' for cross-site requests
      path: '/',
    });

    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("API client logout error:", error);
    res.status(500).json({
      success: false,
      message: "Error during logout",
    });
  }
};

// @desc    Get API usage report
// @route   GET /api/clients/api-report
// @access  Private
export const getApiReport = async (req, res) => {
  try {
    // Get client ID from the token payload
    const clientId = req.apiClient.id;
    if (!clientId) {
      return res.status(400).json({
        success: false,
        message: "Client ID not found in request",
      });
    }

    const client = await APIClient.findById(clientId);
    if (!client) {
      return res.status(404).json({
        success: false,
        message: "API client not found",
      });
    }

    // Get usage data from ApiUsage model
    const usageData = await ApiUsage.aggregate([
      { $match: { clientId: client._id } },
      {
        $group: {
          _id: {
            year: { $year: "$timestamp" },
            month: { $month: "$timestamp" },
            day: { $dayOfMonth: "$timestamp" },
          },
          totalRequests: { $sum: 1 },
          successCount: {
            $sum: { $cond: [{ $eq: ["$status", "success"] }, 1, 0] },
          },
          totalResponseTime: { $sum: "$responseTime" },
          totalRequestSize: { $sum: "$requestSize" },
          totalResponseSize: { $sum: "$responseSize" },
        },
      },
      {
        $project: {
          _id: 0,
          date: {
            $dateFromParts: {
              year: "$_id.year",
              month: "$_id.month",
              day: "$_id.day",
            },
          },
          totalRequests: 1,
          successRate: {
            $multiply: [{ $divide: ["$successCount", "$totalRequests"] }, 100],
          },
          averageResponseTime: {
            $divide: ["$totalResponseTime", "$totalRequests"],
          },
          averageRequestSize: {
            $divide: ["$totalRequestSize", "$totalRequests"],
          },
          averageResponseSize: {
            $divide: ["$totalResponseSize", "$totalRequests"],
          },
        },
      },
      { $sort: { date: -1 } },
      { $limit: 30 },
    ]);

    // Get endpoint usage
    const endpointUsage = await ApiUsage.aggregate([
      { $match: { clientId: client._id } },
      {
        $group: {
          _id: "$endpoint",
          count: { $sum: 1 },
          successCount: {
            $sum: { $cond: [{ $eq: ["$status", "success"] }, 1, 0] },
          },
          avgResponseTime: { $avg: "$responseTime" },
        },
      },
      {
        $project: {
          _id: 0,
          endpoint: "$_id",
          totalRequests: "$count",
          successRate: {
            $multiply: [{ $divide: ["$successCount", "$count"] }, 100],
          },
          averageResponseTime: 1,
        },
      },
      { $sort: { totalRequests: -1 } },
      { $limit: 10 },
    ]);

    res.json({
      success: true,
      data: {
        client: {
          id: client._id,
          name: client.name,
          organization: client.organization.name,
          subscription: client.subscription.tier,
          rateLimits: client.rateLimits,
        },
        usage: {
          daily: usageData,
          endpoints: endpointUsage,
          summary: {
            totalRequests: client.usage.totalRequests,
            storageUsed: client.usage.storageUsed,
            activeUsers: client.usage.activeUsers,
          },
        },
      },
    });
  } catch (error) {
    console.error("Get API report error:", error);
    res.status(500).json({
      success: false,
      message: "Error getting API report",
    });
  }
};

// @desc    Get detailed API usage for a specific endpoint
// @route   GET /api/clients/api-report/:endpoint
// @access  Private
export const getEndpointReport = async (req, res) => {
  try {
    const { endpoint } = req.params;
    const client = await APIClient.findById(req.apiClient._id);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "API client not found",
      });
    }

    // Get date range from query params (default to last 30 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    // Filter usage data for the specific endpoint
    const endpointUsage = client.apiUsage.filter((usage) => {
      const usageDate = new Date(usage.timestamp);
      return (
        usage.endpoint === endpoint &&
        usageDate >= startDate &&
        usageDate <= endDate
      );
    });

    // Calculate detailed statistics
    const totalRequests = endpointUsage.length;
    const successfulRequests = endpointUsage.filter(
      (usage) => usage.status === "success"
    ).length;
    const failedRequests = totalRequests - successfulRequests;

    // Calculate average response time
    const totalResponseTime = endpointUsage.reduce(
      (sum, usage) => sum + (usage.responseTime || 0),
      0
    );
    const avgResponseTime =
      totalRequests > 0 ? totalResponseTime / totalRequests : 0;

    // Group by error type for failed requests
    const errorStats = endpointUsage
      .filter((usage) => usage.status === "failed")
      .reduce((acc, usage) => {
        const errorType = usage.errorType || "unknown";
        acc[errorType] = (acc[errorType] || 0) + 1;
        return acc;
      }, {});

    res.json({
      success: true,
      data: {
        endpoint,
        summary: {
          totalRequests,
          successfulRequests,
          failedRequests,
          successRate:
            totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0,
          avgResponseTime,
        },
        errorStats,
        usage: endpointUsage.map((usage) => ({
          timestamp: usage.timestamp,
          status: usage.status,
          responseTime: usage.responseTime,
          errorType: usage.errorType,
          requestData: usage.requestData,
        })),
      },
    });
  } catch (error) {
    console.error("Get endpoint report error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching endpoint report",
    });
  }
};

// @desc    Get users registered with the API client
// @route   GET /api/clients/users
// @access  Private
export const getClientUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", status = "all" } = req.query;
    const skip = (page - 1) * limit;

    // Build query
    const query = {
      registeredBy: req.apiClient._id,
      role: "user", // Only get users with role 'user'
    };

    if (status !== "all") {
      query.status = status;
    }
    if (search) {
      query.$or = [
        { email: { $regex: search, $options: "i" } },
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
      ];
    }

    // Get total count for pagination
    const total = await User.countDocuments(query);

    // Get users with pagination
    const users = await User.find(query)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: {
        users,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Get client users error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching users",
    });
  }
};

// @desc    Update user status
// @route   PUT /api/clients/users/:userId/status
// @access  Private
export const updateUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.body;

    // Validate status
    if (!["active", "pending", "suspended"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    // Find user and verify it belongs to this API client
    const user = await User.findOne({
      _id: userId,
      registeredBy: req.apiClient._id,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Update status
    user.status = status;
    await user.save();

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("Update user status error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating user status",
    });
  }
};

// @desc    Update client subscription
// @route   PUT /api/clients/:id/subscription
// @access  Private/Admin
export const updateSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const { tier, endDate, features } = req.body;

    const client = await APIClient.findById(id);
    if (!client) {
      return res.status(404).json({
        success: false,
        message: "API client not found",
      });
    }

    // Update subscription
    client.subscription = {
      ...client.subscription,
      tier: tier || client.subscription.tier,
      endDate: endDate ? new Date(endDate) : client.subscription.endDate,
      features: features || client.subscription.features,
    };

    await client.save();

    res.json({
      success: true,
      data: {
        subscription: client.subscription,
      },
    });
  } catch (error) {
    console.error("Subscription update error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating subscription",
    });
  }
};

// @desc    Get client subscription status
// @route   GET /api/clients/subscription
// @access  Private
export const getSubscriptionStatus = async (req, res) => {
  try {
    const clientId = req.user.clientId;
    const client = await APIClient.findById(clientId);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "API client not found",
      });
    }

    // Get webhook count
    const webhookCount = await Webhook.countDocuments({ clientId });

    res.json({
      success: true,
      data: {
        subscription: client.subscription,
        usage: {
          webhooks: {
            current: webhookCount,
            limit: client.subscription.features.maxWebhooks,
          },
          apiKeys: {
            current: client.apiKeys.length,
            limit: client.subscription.features.maxApiKeys,
          },
        },
        isActive: client.isSubscriptionActive(),
      },
    });
  } catch (error) {
    console.error("Subscription status error:", error);
    res.status(500).json({
      success: false,
      message: "Error getting subscription status",
    });
  }
};

// @desc    Update client settings
// @route   PUT /api/clients/settings
// @access  Private
export const updateClientSettings = async (req, res) => {
  try {
    const clientId = req.user.clientId;
    const { notifications, security, apiPreferences } = req.body;

    const client = await APIClient.findById(clientId);
    if (!client) {
      return res.status(404).json({
        success: false,
        message: "API client not found",
      });
    }

    // Update settings
    if (notifications) {
      client.settings.notifications = {
        ...client.settings.notifications,
        ...notifications,
      };
    }
    if (security) {
      client.settings.security = {
        ...client.settings.security,
        ...security,
      };
    }
    if (apiPreferences) {
      client.settings.apiPreferences = {
        ...client.settings.apiPreferences,
        ...apiPreferences,
      };
    }

    await client.save();

    res.json({
      success: true,
      data: {
        settings: client.settings,
      },
    });
  } catch (error) {
    console.error("Settings update error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating settings",
    });
  }
};

// @desc    Get client usage statistics
// @route   GET /api/clients/usage
// @access  Private (API Client)
export const getClientUsage = async (req, res) => {
  try {
    const clientId = req.apiClient._id;

    // Get usage data for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const usageData = await ApiUsage.aggregate([
      {
        $match: {
          clientId: new mongoose.Types.ObjectId(clientId),
          timestamp: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
            endpoint: "$endpoint",
          },
          totalRequests: { $sum: 1 },
          successfulRequests: {
            $sum: { $cond: [{ $eq: ["$status", "success"] }, 1, 0] },
          },
          totalResponseTime: { $sum: "$responseTime" },
        },
      },
      {
        $group: {
          _id: "$_id.date",
          endpoints: {
            $push: {
              path: "$_id.endpoint",
              totalRequests: "$totalRequests",
              successRate: {
                $multiply: [
                  { $divide: ["$successfulRequests", "$totalRequests"] },
                  100,
                ],
              },
              averageResponseTime: {
                $divide: ["$totalResponseTime", "$totalRequests"],
              },
            },
          },
          totalRequests: { $sum: "$totalRequests" },
          successRate: {
            $avg: {
              $multiply: [
                { $divide: ["$successfulRequests", "$totalRequests"] },
                100,
              ],
            },
          },
          averageResponseTime: {
            $avg: { $divide: ["$totalResponseTime", "$totalRequests"] },
          },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // Get total storage used
    const storageUsed = await User.aggregate([
      {
        $match: {
          clientId: new mongoose.Types.ObjectId(clientId),
        },
      },
      {
        $group: {
          _id: null,
          totalStorage: { $sum: "$storageUsed" },
        },
      },
    ]);

    // Get active users count
    const activeUsers = await User.countDocuments({
      clientId: new mongoose.Types.ObjectId(clientId),
      status: "active",
    });

    // Format the response
    const formattedData = {
      summary: {
        totalRequests: usageData.reduce(
          (sum, day) => sum + day.totalRequests,
          0
        ),
        storageUsed: storageUsed[0]?.totalStorage || 0,
        activeUsers,
      },
      daily: usageData.map((day) => ({
        date: day._id,
        totalRequests: day.totalRequests,
        successRate: day.successRate,
        averageResponseTime: day.averageResponseTime,
        endpoints: day.endpoints,
      })),
    };

    res.json({
      success: true,
      data: formattedData,
    });
  } catch (error) {
    console.error("Usage statistics error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching usage statistics",
    });
  }
};

// @desc    Update billing settings
// @route   PUT /api/clients/billing
// @access  Private
export const updateBillingSettings = async (req, res) => {
  try {
    const clientId = req.user.clientId;
    const { plan, autoRenew } = req.body;

    const client = await APIClient.findById(clientId);
    if (!client) {
      return res.status(404).json({
        success: false,
        message: "API client not found",
      });
    }

    // Update billing settings
    if (plan) {
      client.subscription.billing.plan = plan;
      // Update next billing date based on plan
      const now = new Date();
      client.subscription.billing.lastBillingDate = now;
      switch (plan) {
        case "monthly":
          client.subscription.billing.nextBillingDate = new Date(
            now.setMonth(now.getMonth() + 1)
          );
          break;
        case "quarterly":
          client.subscription.billing.nextBillingDate = new Date(
            now.setMonth(now.getMonth() + 3)
          );
          break;
        case "annual":
          client.subscription.billing.nextBillingDate = new Date(
            now.setFullYear(now.getFullYear() + 1)
          );
          break;
      }
    }
    if (typeof autoRenew === "boolean") {
      client.subscription.billing.autoRenew = autoRenew;
    }

    await client.save();

    res.json({
      success: true,
      data: {
        billing: client.subscription.billing,
      },
    });
  } catch (error) {
    console.error("Billing settings update error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating billing settings",
    });
  }
};

// @desc    Get client information
// @route   GET /api/clients/profile
// @access  Private
export const getClientInfo = async (req, res) => {
  try {
    // Get client ID from the token payload
    const clientId = req.apiClient.id;
    if (!clientId) {
      return res.status(400).json({
        success: false,
        message: "Client ID not found in request",
      });
    }

    const client = await APIClient.findById(clientId).select(
      "-clientSecret -representative.password"
    );

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "API client not found",
      });
    }

    res.json({
      success: true,
      data: {
        id: client._id,
        name: client.name,
        organization: client.organization,
        contactPerson: client.contactPerson,
        permissions: client.permissions,
        status: client.status,
        ekycConfig: client.ekycConfig,
        ipWhitelist: client.ipWhitelist,
        rateLimits: client.rateLimits,
        subscription: client.subscription,
        settings: client.settings,
        usage: client.usage,
        representative: {
          email: client.representative.email,
          firstName: client.representative.firstName,
          lastName: client.representative.lastName,
          phoneNumber: client.representative.phoneNumber,
          role: client.representative.role,
        },
        apiKeys: client.apiKeys.map((key) => ({
          id: key._id,
          status: key.status,
          createdAt: key.createdAt,
          lastUsed: key.lastUsed,
          expiresAt: key.expiresAt,
        })),
      },
    });
  } catch (error) {
    console.error("Get client info error:", error);
    res.status(500).json({
      success: false,
      message: "Error getting client information",
    });
  }
};

// @desc    Update client information
// @route   PUT /api/clients/profile
// @access  Private
export const updateClientInfo = async (req, res) => {
  try {
    const clientId = req.user.clientId;
    const {
      name,
      organization,
      contactPerson,
      ipWhitelist,
      rateLimits,
      ekycConfig,
    } = req.body;

    const client = await APIClient.findById(clientId);
    if (!client) {
      return res.status(404).json({
        success: false,
        message: "API client not found",
      });
    }

    // Update fields if provided
    if (name) client.name = name;
    if (organization) client.organization = organization;
    if (contactPerson) client.contactPerson = contactPerson;
    if (ipWhitelist) client.ipWhitelist = ipWhitelist;
    if (rateLimits) client.rateLimits = rateLimits;
    if (ekycConfig) client.ekycConfig = ekycConfig;

    await client.save();

    res.json({
      success: true,
      data: {
        id: client._id,
        name: client.name,
        organization: client.organization,
        contactPerson: client.contactPerson,
        ipWhitelist: client.ipWhitelist,
        rateLimits: client.rateLimits,
        ekycConfig: client.ekycConfig,
      },
    });
  } catch (error) {
    console.error("Update client info error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating client information",
    });
  }
};

// @desc    Get all webhooks for a client
// @route   GET /api/clients/webhooks
// @access  Private (API Client)
export const getWebhooks = async (req, res) => {
  try {
    const webhooks = await Webhook.find({ clientId: req.apiClient._id });
    res.json({
      success: true,
      data: webhooks,
    });
  } catch (error) {
    console.error("Error fetching webhooks:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching webhooks",
    });
  }
};

// @desc    Create a new webhook
// @route   POST /api/clients/webhooks
// @access  Private (API Client)
export const createWebhook = async (req, res) => {
  try {
    const { url, events, secret, description } = req.body;

    // Check webhook limit
    const webhookCount = await Webhook.countDocuments({
      clientId: req.apiClient._id,
    });
    if (webhookCount >= req.apiClient.subscription.features.maxWebhooks) {
      return res.status(400).json({
        success: false,
        message: "Webhook limit reached for your subscription tier",
      });
    }

    const webhook = await Webhook.create({
      clientId: req.apiClient._id,
      url,
      events,
      secret,
      description,
      isActive: true,
    });

    res.status(201).json({
      success: true,
      data: webhook,
    });
  } catch (error) {
    console.error("Error creating webhook:", error);
    res.status(500).json({
      success: false,
      message: "Error creating webhook",
    });
  }
};

// @desc    Update a webhook
// @route   PUT /api/clients/webhooks/:id
// @access  Private (API Client)
export const updateWebhook = async (req, res) => {
  try {
    const { id } = req.params;
    const { url, events, secret, description, isActive } = req.body;

    const webhook = await Webhook.findOne({
      _id: id,
      clientId: req.apiClient._id,
    });

    if (!webhook) {
      return res.status(404).json({
        success: false,
        message: "Webhook not found",
      });
    }

    webhook.url = url || webhook.url;
    webhook.events = events || webhook.events;
    webhook.secret = secret || webhook.secret;
    webhook.description = description || webhook.description;
    webhook.isActive = isActive !== undefined ? isActive : webhook.isActive;

    await webhook.save();

    res.json({
      success: true,
      data: webhook,
    });
  } catch (error) {
    console.error("Error updating webhook:", error);
    res.status(500).json({
      success: false,
      message: "Error updating webhook",
    });
  }
};

// @desc    Delete a webhook
// @route   DELETE /api/clients/webhooks/:id
// @access  Private (API Client)
export const deleteWebhook = async (req, res) => {
  try {
    const { id } = req.params;

    const webhook = await Webhook.findOneAndDelete({
      _id: id,
      clientId: req.apiClient._id,
    });

    if (!webhook) {
      return res.status(404).json({
        success: false,
        message: "Webhook not found",
      });
    }

    res.json({
      success: true,
      data: webhook,
    });
  } catch (error) {
    console.error("Error deleting webhook:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting webhook",
    });
  }
};

import APIClient from "../models/APIClient.js";
import { generateToken } from "../utils/jwt.js";
import crypto from "crypto";

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
      webhookUrl,
      ekycConfig,
      representative,
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
      webhookUrl,
      ekycConfig,
      representative,
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

// @desc    Login API client representative
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

    // Check if client is active
    if (client.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "API client is not active",
      });
    }

    // Validate representative credentials
    const isValid = await client.validateRepresentativeCredentials(
      email,
      password
    );
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Generate token with payload matching jwt.js generateToken expectation
    const token = generateToken({
      _id: client._id, // Use _id
      email: client.representative.email, // Include representative email
      role: "api-client", // Role
      // Include other data if needed in the token payload, but keep it minimal
      // permissions: client.permissions // Could add permissions here if needed client-side
    });

    // Set HTTP-only cookie
    res.cookie("auth_token_apiclient", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "development",
      sameSite: "strict",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    res.json({
      success: true,
      data: {
        id: client._id,
        name: client.name,
        clientId: client.clientId,
        apiKey: client.apiKey,
        permissions: client.permissions,
        status: client.status,
        ekycConfig: client.ekycConfig,
        representative: {
          email: client.representative.email,
          firstName: client.representative.firstName,
          lastName: client.representative.lastName,
          phoneNumber: client.representative.phoneNumber,
        },
        token,
      },
    });
  } catch (error) {
    console.error("API client login error:", error);
    res.status(500).json({
      success: false,
      message: "Error in API client login",
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
    const apiKeys = client.apiKeys.map(key => ({
      _id: key._id,
      key: key.key,
      status: key.status,
      createdAt: key.createdAt,
      lastUsed: key.lastUsed,
      expiresAt: key.expiresAt
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

    const newApiKey = client.generateNewApiKey();
    await client.save();

    res.json({
      success: true,
      data: {
        id: newApiKey._id,
        key: newApiKey.key,
        status: newApiKey.status,
        createdAt: newApiKey.createdAt,
        expiresAt: newApiKey.expiresAt
      },
    });
  } catch (error) {
    console.error("Generate API key error:", error);
    res.status(500).json({
      success: false,
      message: "Error generating new API key",
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

    apiKey.status = 'revoked';
    await client.save();

    res.json({
      success: true,
      data: {
        _id: apiKey._id,
        status: apiKey.status
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
    apiKey.status = 'active';
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
        expiresAt: apiKey.expiresAt
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
// @access  Private/Admin
export const getAllClients = async (req, res) => {
  try {
    const clients = await APIClient.find()
      .select("-clientSecret -representative.password")
      .sort({ createdAt: -1 });

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

// New function to check API client authentication status
export const checkClientAuthStatus = async (req, res) => {
  try {
    // If we reach this point, the protect middleware has already authenticated the API client
    // The authenticated client object is available in req.apiClient
    if (!req.apiClient) {
      return res.status(401).json({
        success: false,
        message: "Not authorized",
      });
    }

    res.json({
      success: true,
      data: req.apiClient,
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
    // Clear the auth_token_apiclient cookie
    res.cookie("auth_token_apiclient", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "development",
      sameSite: "strict",
    });

    res.json({
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

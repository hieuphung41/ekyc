import { verifyToken } from "../utils/jwt.js";
import User from "../models/User.js";
import APIClient from "../models/APIClient.js";

export const protect = async (req, res, next) => {
  try {
    let token = null;
    
    // Check cookies first
    if (req.cookies?.auth_token) {
      token = req.cookies.auth_token;
    } else if (req.cookies?.auth_token_apiclient) {
      token = req.cookies.auth_token_apiclient;
    } else if (req.headers?.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      console.log('No token found in request');
      return res.status(401).json({
        success: false,
        message: "Not authorized to access this route",
      });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      console.log('Token verification failed');
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }

    if (decoded.role === 'api-client') {
      const apiClient = await APIClient.findById(decoded.id);
      if (!apiClient) {
        console.log('API client not found:', decoded.id);
        return res.status(401).json({
          success: false,
          message: "API client not found",
        });
      }
      req.apiClient = apiClient;
    } else {
      const user = await User.findById(decoded.id).select("-password");
      if (!user) {
        console.log('User not found:', decoded.id);
        return res.status(401).json({
          success: false,
          message: "User not found",
        });
      }
      req.user = user;
    }

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({
      success: false,
      message: "Not authorized to access this route",
    });
  }
};

export const authorize = (...roles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Not authorized to access this route",
        });
      }

      if (!roles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: `User role ${req.user.role} is not authorized to access this route`,
        });
      }

      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: "Not authorized to access this route",
      });
    }
  };
};

export const checkEkycPermission = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      if (!req.apiClient) {
        return res.status(401).json({
          success: false,
          message: "Not authorized to access this route",
        });
      }

      if (!req.apiClient.permissions.includes(requiredPermission)) {
        return res.status(403).json({
          success: false,
          message: `API client does not have permission: ${requiredPermission}`,
        });
      }

      if (requiredPermission === 'ekyc_face_verify' && !req.apiClient.ekycConfig.allowedVerificationMethods.face) {
        return res.status(403).json({
          success: false,
          message: "Face verification is not enabled for this client",
        });
      }
      if (requiredPermission === 'ekyc_voice_verify' && !req.apiClient.ekycConfig.allowedVerificationMethods.voice) {
        return res.status(403).json({
          success: false,
          message: "Voice verification is not enabled for this client",
        });
      }
      if (requiredPermission === 'ekyc_document_verify' && !req.apiClient.ekycConfig.allowedVerificationMethods.document) {
        return res.status(403).json({
          success: false,
          message: "Document verification is not enabled for this client",
        });
      }

      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: "Not authorized to access this route",
      });
    }
  };
};



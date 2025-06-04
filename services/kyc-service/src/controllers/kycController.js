import KYC from '../models/KYC.js';
import { validationResult } from 'express-validator';
import axios from "axios";
import { deleteFile } from "../utils/fileUpload.js";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import fsp from "fs/promises";
import FormData from "form-data";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import sdk from "microsoft-cognitiveservices-speech-sdk";
import dotenv from "dotenv";

dotenv.config();

const UPLOAD_DIR = process.env.ID_UPLOAD_DIR || path.join(process.cwd(), "uploads");
const FPT_API_KEY = process.env.FPT_AI_API_KEY;
const ISSUING_COUNTRY_DEFAULT = process.env.ID_ISSUING_COUNTRY || "Vietnam";
const AZURE_SPEECH_KEY = process.env.AZURE_KEY;
const AZURE_SPEECH_REGION = "eastus";

// Helper function to safely delete files
async function safeUnlink(filePath) {
  try {
    await fsp.unlink(filePath);
  } catch (err) {
    console.warn(`Failed to delete file ${filePath}:`, err.message);
  }
}

// Submit KYC verification
export const submitKYC = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      documentType,
      documentNumber,
      documentImages,
      personalInfo
    } = req.body;

    // Check if user already has a KYC submission
    const existingKYC = await KYC.findOne({ userId: req.user.id });
    if (existingKYC) {
      return res.status(400).json({ message: 'KYC submission already exists' });
    }

    // Create new KYC submission
    const kyc = await KYC.create({
      userId: req.user.id,
      documentType,
      documentNumber,
      documentImages,
      personalInfo
    });

    res.status(201).json({
      message: 'KYC submission successful',
      kyc
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get KYC status
export const getKYCStatus = async (req, res) => {
  try {
    let kyc = await KYC.findOne({ userId: req.user.id })
      .select(
        "-biometricData.faceData.imageUrl -biometricData.videoData.videoUrl -documents.frontImageUrl -documents.backImageUrl"
      )
      .sort({ createdAt: -1 });

    if (!kyc) {
      // Create new KYC application if none exists
      kyc = await KYC.create({
        userId: req.user.id,
        status: "pending",
        completedSteps: {
          faceVerification: { completed: false },
          documentVerification: { completed: false },
          videoVerification: { completed: false },
          voiceVerification: { completed: false },
        },
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year expiry
      });
    }

    res.json({
      success: true,
      data: {
        status: kyc.status,
        completedSteps: kyc.completedSteps,
        biometricData: kyc.biometricData,
        livenessCheck: kyc.livenessCheck,
        expiryDate: kyc.expiryDate,
        documents: kyc.documents,
        verificationHistory: kyc.verificationHistory,
        createdAt: kyc.createdAt,
        updatedAt: kyc.updatedAt,
      },
    });
  } catch (error) {
    console.error("KYC status error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching KYC status",
    });
  }
};

// Update KYC submission
export const updateKYC = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const kyc = await KYC.findOne({ userId: req.user.id });
    if (!kyc) {
      return res.status(404).json({ message: 'No KYC submission found' });
    }

    if (kyc.status !== 'pending') {
      return res.status(400).json({ message: 'Cannot update verified or rejected KYC' });
    }

    const {
      documentType,
      documentNumber,
      documentImages,
      personalInfo
    } = req.body;

    // Update KYC submission
    Object.assign(kyc, {
      documentType: documentType || kyc.documentType,
      documentNumber: documentNumber || kyc.documentNumber,
      documentImages: documentImages || kyc.documentImages,
      personalInfo: personalInfo || kyc.personalInfo
    });

    await kyc.save();

    res.json({
      message: 'KYC submission updated successfully',
      kyc
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin: Get all KYC submissions
export const getAllKYC = async (req, res) => {
  try {
    const kycList = await KYC.find()
      .select("-biometricData.faceData.imageUrl -biometricData.videoData.videoUrl -documents.frontImageUrl -documents.backImageUrl")
      .sort({ createdAt: -1 });

    // Get user details from User service
    const kycWithUsers = await Promise.all(
      kycList.map(async (kyc) => {
        try {
          const userResponse = await axios.get(
            `${process.env.USER_SERVICE_URL}/api/users/${kyc.userId}`,
            {
              headers: {
                Authorization: `Bearer ${req.headers.authorization.split(" ")[1]}`,
              },
            }
          );
          return {
            ...kyc.toObject(),
            user: userResponse.data.data,
          };
        } catch (error) {
          console.error(`Error fetching user ${kyc.userId}:`, error);
          return kyc;
        }
      })
    );

    res.json({
      success: true,
      data: kycWithUsers,
    });
  } catch (error) {
    console.error("Get all KYC error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching KYC applications",
    });
  }
};

// Admin: Verify KYC submission
export const verifyKYC = async (req, res) => {
  try {
    const { status, notes } = req.body;
    const kyc = await KYC.findById(req.params.id);

    if (!kyc) {
      return res.status(404).json({
        success: false,
        message: "KYC application not found",
      });
    }

    kyc.status = status;
    kyc.verificationHistory.push({
      action: "verification",
      status,
      notes,
      performedBy: req.user.id,
    });

    await kyc.save();

    // Update user's verification status in User service
    try {
      await axios.patch(
        `${process.env.USER_SERVICE_URL}/api/users/${kyc.userId}/verification-status`,
        {
          isVerified: status === "approved",
          verificationStatus: status,
        },
        {
          headers: {
            Authorization: `Bearer ${req.headers.authorization.split(" ")[1]}`,
          },
        }
      );
    } catch (error) {
      console.error("Error updating user verification status:", error);
    }

    res.json({
      success: true,
      data: kyc,
    });
  } catch (error) {
    console.error("KYC verification error:", error);
    res.status(500).json({
      success: false,
      message: "Error verifying KYC application",
    });
  }
};

// @desc    Upload face photo for verification
// @route   POST /api/kyc/face
// @access  Private
export const uploadFacePhoto = async (req, res) => {
  try {
    const { faceMetadata } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "No face photo uploaded",
      });
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png"];
    if (!allowedTypes.includes(file.mimetype)) {
      await deleteFile(file.path);
      return res.status(400).json({
        success: false,
        message: "Invalid file type. Only JPEG and PNG are allowed",
      });
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      await deleteFile(file.path);
      return res.status(400).json({
        success: false,
        message: "File too large. Maximum size: 5MB",
      });
    }

    // Find existing KYC application
    let kyc = await KYC.findOne({ userId: req.user.id });
    if (!kyc) {
      await deleteFile(file.path);
      return res.status(404).json({
        success: false,
        message: "KYC application not found",
      });
    }

    // Generate secure filename
    const fileExtension = path.extname(file.originalname);
    const secureFilename = `${crypto.randomBytes(16).toString("hex")}${fileExtension}`;

    // Create secure storage path
    const storageDir = path.join(process.cwd(), "storage", "biometric", "face");
    await fs.promises.mkdir(storageDir, { recursive: true });

    // Move file to secure location
    const securePath = path.join(storageDir, secureFilename);
    await fs.promises.rename(file.path, securePath);

    // Process face metadata if available
    let livenessScore = 0;
    let confidence = 0;

    if (faceMetadata) {
      try {
        const metadata = JSON.parse(faceMetadata);
        confidence = metadata.confidence || 0;
        livenessScore = metadata.livenessScore || 0;
      } catch (e) {
        console.error("Error parsing face metadata:", e);
      }
    }

    // Update face data
    kyc.biometricData.faceData = {
      imageUrl: securePath,
      verificationStatus: "pending",
      confidence: confidence,
      livenessScore: livenessScore,
      uploadedAt: new Date(),
      fileType: file.mimetype,
      fileSize: file.size,
    };

    // Mark face verification step as completed if liveness passed
    if (livenessScore > 0.5) {
      kyc.completedSteps.faceVerification = {
        completed: true,
        completedAt: new Date(),
        attempts: (kyc.completedSteps.faceVerification?.attempts || 0) + 1,
      };
    }

    await kyc.save();

    // Update user's verification status in User service
    try {
      await axios.patch(
        `${process.env.USER_SERVICE_URL}/api/users/${req.user.id}/verification-status`,
        {
          isVerified: kyc.status === "approved",
          verificationStatus: kyc.status,
        },
        {
          headers: {
            Authorization: `Bearer ${req.headers.authorization.split(" ")[1]}`,
          },
        }
      );
    } catch (error) {
      console.error("Error updating user verification status:", error);
    }

    res.json({
      success: true,
      data: {
        status: "pending",
        livenessScore: kyc.biometricData.faceData.livenessScore,
        currentStep: kyc.currentStep,
        completedSteps: kyc.completedSteps,
      },
    });
  } catch (error) {
    console.error("Face photo upload error:", error);
    if (req.file?.path) {
      await deleteFile(req.file.path);
    }
    res.status(500).json({
      success: false,
      message: "Error uploading face photo",
    });
  }
};

// @desc    Upload ID document for verification
// @route   POST /api/kyc/document
// @access  Private
export const uploadIDDocument = async (req, res) => {
  try {
    if (!FPT_API_KEY) {
      return res.status(500).json({
        success: false,
        message: "FPT AI API key is not configured",
      });
    }

    const { frontImage, backImage } = req.files;
    const { documentType } = req.body;
    const userId = req.user.id;

    // Validate document type
    const validTypes = ["nationalId", "passport", "drivingLicense"];
    if (!validTypes.includes(documentType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid document type",
      });
    }

    // Validate files
    if (!frontImage?.[0] || !backImage?.[0]) {
      return res.status(400).json({
        success: false,
        message: "Both front and back images are required",
      });
    }

    const allowedTypes = ["image/png", "image/jpeg", "image/jpg"];
    if (
      !allowedTypes.includes(frontImage[0].mimetype) ||
      !allowedTypes.includes(backImage[0].mimetype)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid file format. Only PNG and JPG are allowed.",
      });
    }

    try {
      await fsp.access(UPLOAD_DIR);
    } catch {
      await fsp.mkdir(UPLOAD_DIR, { recursive: true });
    }

    const frontFileName = `${userId}-${documentType}-front-${Date.now()}.${
      frontImage[0].mimetype.split("/")[1]
    }`;
    const backFileName = `${userId}-${documentType}-back-${Date.now()}.${
      backImage[0].mimetype.split("/")[1]
    }`;
    const frontFilePath = path.join(UPLOAD_DIR, frontFileName);
    const backFilePath = path.join(UPLOAD_DIR, backFileName);

    const frontBuffer = await fsp.readFile(frontImage[0].path);
    const backBuffer = await fsp.readFile(backImage[0].path);

    await fsp.writeFile(frontFilePath, frontBuffer);
    await fsp.writeFile(backFilePath, backBuffer);

    // Process with FPT AI based on document type
    const formData = new FormData();
    formData.append("image", fs.createReadStream(frontFilePath));

    let fptResponse;
    if (documentType === "nationalId") {
      fptResponse = await axios.post(
        "https://api.fpt.ai/vision/idr/vnm",
        formData,
        {
          headers: {
            "api-key": FPT_API_KEY,
            "Content-Type": "multipart/form-data",
            ...formData.getHeaders(),
          },
        }
      );
    } else if (documentType === "passport") {
      fptResponse = await axios.post(
        "https://api.fpt.ai/vision/passport/vnm",
        formData,
        {
          headers: {
            "api-key": FPT_API_KEY,
            "Content-Type": "multipart/form-data",
            ...formData.getHeaders(),
          },
        }
      );
    } else if (documentType === "drivingLicense") {
      fptResponse = await axios.post(
        "https://api.fpt.ai/vision/dlr/vnm",
        formData,
        {
          headers: {
            "api-key": FPT_API_KEY,
            "Content-Type": "multipart/form-data",
            ...formData.getHeaders(),
          },
        }
      );
    }

    const fptData = fptResponse.data;

    if (fptResponse.status === 200 && fptData.data && fptData.data.length > 0) {
      const extractedData = fptData.data[0];
      let documentNumber;

      // Extract document number based on document type
      switch (documentType) {
        case "nationalId":
          documentNumber = extractedData.id;
          break;
        case "passport":
          documentNumber = extractedData.passport_number;
          break;
        case "drivingLicense":
          documentNumber = extractedData.license_number;
          break;
      }

      const existingKYC = await KYC.findOne({
        "documents.documentNumber": documentNumber,
      });

      if (existingKYC) {
        await safeUnlink(frontFilePath);
        await safeUnlink(backFilePath);
        return res.status(400).json({
          success: false,
          message: "This document number has already been registered",
        });
      }

      const kyc = await KYC.findOne({ userId });
      if (!kyc) {
        await safeUnlink(frontFilePath);
        await safeUnlink(backFilePath);
        return res.status(404).json({
          success: false,
          message: "KYC application not found",
        });
      }

      // Add new document
      kyc.documents.push({
        type: documentType,
        documentNumber: documentNumber,
        issuingCountry: ISSUING_COUNTRY_DEFAULT,
        frontImageUrl: `/uploads/${frontFileName}`,
        backImageUrl: `/uploads/${backFileName}`,
        verificationStatus: "pending",
        ocrData: {
          extractedFields: extractedData,
          confidence: fptData.confidence || 1,
          processedAt: new Date(),
        },
      });

      // Mark document verification step as completed
      kyc.completedSteps.documentVerification = {
        completed: true,
        completedAt: new Date(),
        attempts: (kyc.completedSteps.documentVerification?.attempts || 0) + 1,
      };

      await kyc.save();

      return res.status(200).json({
        success: true,
        message: "Document processed successfully",
        data: kyc.documents[kyc.documents.length - 1],
      });
    } else {
      await safeUnlink(frontFilePath);
      await safeUnlink(backFilePath);
      return res.status(400).json({
        success: false,
        message: "Document verification failed",
      });
    }
  } catch (error) {
    console.error("Error processing document:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to process document",
      error: error.message,
    });
  }
};

// @desc    Reset a specific KYC step (for retrying)
// @route   POST /api/kyc/reset-step
// @access  Private
export const resetKycStep = async (req, res) => {
  try {
    const { step } = req.body;

    if (
      !step ||
      ![
        "faceVerification",
        "documentVerification",
        "videoVerification",
        "voiceVerification",
      ].includes(step)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid step specified",
      });
    }

    const kyc = await KYC.findOne({ userId: req.user.id });

    if (!kyc) {
      return res.status(404).json({
        success: false,
        message: "No KYC application found",
      });
    }

    if (kyc.status === "approved") {
      return res.status(400).json({
        success: false,
        message: "Cannot reset steps for an approved KYC application",
      });
    }

    // Reset specified step
    kyc.completedSteps[step].completed = false;

    // Remove related data
    if (step === "faceVerification") {
      if (kyc.biometricData.faceData?.imageUrl) {
        await deleteFile(kyc.biometricData.faceData.imageUrl);
        kyc.biometricData.faceData = {};
      }
      kyc.livenessCheck = {
        status: "pending",
        score: 0,
      };
    } else if (step === "documentVerification") {
      if (kyc.documents && kyc.documents.length > 0) {
        // Delete document images
        if (kyc.documents[0].frontImageUrl) {
          await deleteFile(kyc.documents[0].frontImageUrl);
        }
        if (kyc.documents[0].backImageUrl) {
          await deleteFile(kyc.documents[0].backImageUrl);
        }
        // Reset OCR data but keep document type
        const docType = kyc.documents[0].type;
        kyc.documents = [
          {
            type: docType,
            verificationStatus: "pending",
          },
        ];
      }
    } else if (step === "videoVerification") {
      if (kyc.biometricData.videoData?.videoUrl) {
        await deleteFile(kyc.biometricData.videoData.videoUrl);
        kyc.biometricData.videoData = {};
      }
    } else if (step === "voiceVerification") {
      if (kyc.biometricData.voiceData?.audioUrl) {
        await deleteFile(kyc.biometricData.voiceData.audioUrl);
        kyc.biometricData.voiceData = {};
      }
    }

    // Set status back to pending if it was rejected
    if (kyc.status === "rejected") {
      kyc.status = "pending";
    }

    // Add to verification history
    kyc.verificationHistory.push({
      action: "reset-step",
      status: "pending",
      notes: `Step ${step} reset for retry`,
      performedBy: req.user.id,
    });

    await kyc.save();

    // Update user's verification status in User service
    try {
      await axios.patch(
        `${process.env.USER_SERVICE_URL}/api/users/${req.user.id}/verification-status`,
        {
          isVerified: false,
          verificationStatus: "pending",
        },
        {
          headers: {
            Authorization: `Bearer ${req.headers.authorization.split(" ")[1]}`,
          },
        }
      );
    } catch (error) {
      console.error("Error updating user verification status:", error);
    }

    res.json({
      success: true,
      data: {
        completedSteps: kyc.completedSteps,
        status: kyc.status,
      },
    });
  } catch (error) {
    console.error("KYC step reset error:", error);
    res.status(500).json({
      success: false,
      message: "Error resetting KYC step",
    });
  }
}; 
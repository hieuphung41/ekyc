import KYC from "../models/KYC.js";
import User from "../models/User.js";
import { uploadMiddleware, deleteFile } from "../utils/fileUpload.js";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import fsp from "fs/promises";
import axios from "axios";
import FormData from "form-data";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import sdk from "microsoft-cognitiveservices-speech-sdk";
import dotenv from "dotenv";
import {
  uploadToBlobStorage,
  deleteFromBlobStorage,
  CONTAINERS,
  generateSasToken,
} from "../utils/azureStorage.js";
import { promisify } from "util";
import { exec } from "child_process";

dotenv.config();

const UPLOAD_DIR =
  process.env.ID_UPLOAD_DIR || path.join(process.cwd(), "public", "uploads");
const FPT_AI_API_KEY = process.env.FPT_AI_API_KEY;
const ISSUING_COUNTRY_DEFAULT = process.env.ID_ISSUING_COUNTRY || "Vietnam";
const AZURE_SPEECH_KEY = process.env.AZURE_KEY;
const AZURE_SPEECH_REGION = "eastus";

const execAsync = promisify(exec);

// Add this function at the top level
const checkFFmpegInstallation = async () => {
  try {
    await execAsync("ffmpeg -version");
    return true;
  } catch (error) {
    console.error("FFmpeg is not installed or not in PATH:", error);
    return false;
  }
};

async function safeUnlink(filePath) {
  try {
    await fsp.unlink(filePath);
  } catch (err) {
    console.warn(`Failed to delete file ${filePath}:`, err.message);
  }
}

// @desc    Upload face photo for verification
// @route   POST /api/kyc/face
// @access  Private
export const uploadFacePhoto = async (req, res) => {
  try {
    const { faceMetadata } = req.body;
    const file = req.file;

    console.log('Controller received file:', {
      originalname: file?.originalname,
      mimetype: file?.mimetype,
      size: file?.size,
      hasBuffer: file?.buffer ? true : false,
      bufferSize: file?.buffer?.length
    });

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "No face photo uploaded",
      });
    }

    if (!file.buffer) {
      console.error('File has no buffer:', file);
      return res.status(400).json({
        success: false,
        message: "Invalid file format - no buffer data",
      });
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
    if (!allowedTypes.includes(file.mimetype)) {
      console.log('Invalid mimetype:', file.mimetype);
      return res.status(400).json({
        success: false,
        message: "Invalid file type. Only JPEG and PNG are allowed",
      });
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return res.status(400).json({
        success: false,
        message: "File too large. Maximum size: 5MB",
      });
    }

    // Find existing KYC application
    let kyc = await KYC.findOne({ userId: req.user.id });
    if (!kyc) {
      return res.status(404).json({
        success: false,
        message: "KYC application not found",
      });
    }

    // Generate a unique blob name
    const fileExtension = path.extname(file.originalname);
    const blobName = `${req.user.id}-face-${Date.now()}${fileExtension}`;

    console.log('Attempting to upload to Azure:', {
      blobName,
      contentType: file.mimetype,
      bufferSize: file.buffer.length
    });

    // Upload the file to Azure Blob Storage
    const blobUrl = await uploadToBlobStorage(
      file.buffer,
      CONTAINERS.FACE,
      blobName,
      file.mimetype
    );

    console.log('Successfully uploaded to Azure:', blobUrl);

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
      imageUrl: blobUrl,
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

    // Update KYC state in cookie
    res.cookie("kycCompletedSteps", JSON.stringify(kyc.completedSteps), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

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
    const { documentType } = req.body;
    const frontImage = req.files?.front?.[0];
    const backImage = req.files?.back?.[0];

    if (!FPT_AI_API_KEY) {
      return res.status(500).json({
        success: false,
        message: "FPT API key not configured",
      });
    }

    if (
      !documentType ||
      !["national_id", "passport", "driving_license"].includes(documentType)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid document type",
      });
    }

    if (!frontImage || !backImage) {
      return res.status(400).json({
        success: false,
        message: "Both front and back images are required",
      });
    }

    const userId = req.user.id;

    // Generate unique blob names
    const frontBlobName = `${userId}-${documentType}-front-${Date.now()}.${
      frontImage.mimetype.split("/")[1]
    }`;
    const backBlobName = `${userId}-${documentType}-back-${Date.now()}.${
      backImage.mimetype.split("/")[1]
    }`;

    // Upload images to Azure Blob Storage
    const [frontBlobUrl, backBlobUrl] = await Promise.all([
      uploadToBlobStorage(
        frontImage.buffer,
        CONTAINERS.DOCUMENT,
        frontBlobName,
        frontImage.mimetype
      ),
      uploadToBlobStorage(
        backImage.buffer,
        CONTAINERS.DOCUMENT,
        backBlobName,
        backImage.mimetype
      ),
    ]);

    // Process with FPT AI API based on document type
    let fptEndpoint;
    switch (documentType) {
      case "national_id":
        fptEndpoint = "https://api.fpt.ai/vision/idr/vnm";
        break;
      case "passport":
        fptEndpoint = "https://api.fpt.ai/vision/passport/vnm";
        break;
      case "driving_license":
        fptEndpoint = "https://api.fpt.ai/vision/dlr/vnm";
        break;
    }

    const formData = new FormData();
    formData.append("image", frontImage.buffer, {
      filename: frontBlobName,
      contentType: frontImage.mimetype,
    });

    const response = await axios.post(fptEndpoint, formData, {
      headers: {
        "api-key": FPT_AI_API_KEY,
        ...formData.getHeaders(),
      },
    });

    const fptData = response.data;

    if (!fptData) {
      throw new Error("Invalid response from FPT AI API");
    }

    const documentData = fptData.data[fptData.data.length - 1];
    const documentNumber =
      documentData.id ||
      documentData.passport_number ||
      documentData.license_number;

    // Check if document number already exists
    const existingKYC = await KYC.findOne({
      "documents.documentNumber": documentNumber,
    });

    if (existingKYC) {
      // Delete uploaded blobs
      await Promise.all([
        deleteFromBlobStorage(CONTAINERS.DOCUMENT, frontBlobName),
        deleteFromBlobStorage(CONTAINERS.DOCUMENT, backBlobName),
      ]);

      return res.status(400).json({
        success: false,
        message: "Document number already registered",
      });
    }

    // Find existing KYC application
    let kyc = await KYC.findOne({ userId });
    if (!kyc) {
      // Delete uploaded blobs
      await Promise.all([
        deleteFromBlobStorage(CONTAINERS.DOCUMENT, frontBlobName),
        deleteFromBlobStorage(CONTAINERS.DOCUMENT, backBlobName),
      ]);

      return res.status(404).json({
        success: false,
        message: "KYC application not found",
      });
    }

    // Add new document
    kyc.documents.push({
      type: documentType,
      frontImageUrl: frontBlobUrl,
      backImageUrl: backBlobUrl,
      documentNumber: documentNumber,
      verificationStatus: "pending",
      uploadedAt: new Date(),
      extractedData: documentData,
      ocrData: {
        extractedFields: documentData,
        confidence: fptData.confidence || 1,
        processedAt: new Date(),
      },
    });

    // Update verification status
    kyc.verificationStatus = "pending";
    kyc.currentStep = "face_verification";

    // Mark document verification step as completed
    kyc.completedSteps.documentVerification = {
      completed: true,
      completedAt: new Date(),
      attempts: (kyc.completedSteps.documentVerification?.attempts || 0) + 1,
    };

    await kyc.save();

    // Update KYC state in cookie
    res.cookie("kycCompletedSteps", JSON.stringify(kyc.completedSteps), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "development",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      success: true,
      data: {
        status: "pending",
        currentStep: kyc.currentStep,
        completedSteps: kyc.completedSteps,
      },
    });
  } catch (error) {
    console.error("Document upload error:", error);
    res.status(500).json({
      success: false,
      message: "Error uploading document",
    });
  }
};

// @desc    Upload video for verification
// @route   POST /api/kyc/video
// @access  Private
export const uploadVideo = async (req, res) => {
  try {
    const videoFile = req.file;
    const userId = req.user.id;

    if (!videoFile) {
      return res.status(400).json({
        success: false,
        message: "No video file uploaded",
      });
    }

    // Validate file type
    const allowedTypes = ["video/webm", "video/mp4"];
    if (!allowedTypes.includes(videoFile.mimetype)) {
      return res.status(400).json({
        success: false,
        message: "Invalid file type. Only WebM and MP4 are allowed",
      });
    }

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024;
    if (videoFile.size > maxSize) {
      return res.status(400).json({
        success: false,
        message: "File too large. Maximum size: 50MB",
      });
    }

    // Find existing KYC application
    let kyc = await KYC.findOne({ userId });
    if (!kyc) {
      return res.status(404).json({
        success: false,
        message: "KYC application not found",
      });
    }

    // Get the most recent document from KYC
    const latestDocument = kyc.documents[kyc.documents.length - 1];
    if (!latestDocument || !latestDocument.frontImageUrl) {
      return res.status(400).json({
        success: false,
        message:
          "ID card image not found. Please complete document verification first.",
      });
    }

    // Handle video conversion
    let videoBuffer = videoFile.buffer;
    let videoMimeType = videoFile.mimetype;

    if (videoFile.mimetype === "video/webm") {
      try {
        // Check if ffmpeg is available
        if (!ffmpegStatic) {
          throw new Error("ffmpeg not found");
        }

        // Create temporary files for conversion
        const tempDir = path.join(process.cwd(), "uploads", "temp");
        await fs.promises.mkdir(tempDir, { recursive: true });

        const inputPath = path.join(tempDir, `input-${Date.now()}.webm`);
        const outputPath = path.join(tempDir, `output-${Date.now()}.mp4`);

        // Write buffer to temporary file
        await fs.promises.writeFile(inputPath, videoFile.buffer);

        // Convert video
        await new Promise((resolve, reject) => {
          ffmpeg(inputPath)
            .setFfmpegPath(ffmpegStatic)
            .output(outputPath)
            .on("end", () => {
              resolve();
            })
            .on("error", (err) => {
              reject(err);
            })
            .run();
        });

        // Read converted file
        videoBuffer = await fs.promises.readFile(outputPath);
        videoMimeType = "video/mp4";

        // Clean up temporary files
        await fs.promises.unlink(inputPath);
        await fs.promises.unlink(outputPath);
      } catch (error) {
        console.error("Error converting video:", error);
        if (error.message.includes("ffmpeg not found")) {
          console.warn("FFmpeg not found, using original video file");
          // Continue with original file
        } else {
          return res.status(500).json({
            success: false,
            message: "Error converting video format",
          });
        }
      }
    }

    // Generate a unique blob name for Azure Storage
    const blobName = `${userId}-video-${Date.now()}.${
      videoMimeType.split("/")[1]
    }`;

    try {
      // Upload to Azure Blob Storage
      const blobUrl = await uploadToBlobStorage(
        videoBuffer,
        CONTAINERS.VIDEO,
        blobName,
        videoMimeType
      );

      // Prepare files for FPT AI liveness detection
      const formData = new FormData();

      // Add video file
      formData.append("video", videoBuffer, {
        filename: "video.mp4",
        contentType: videoMimeType,
      });

      // Add ID card image from Azure Blob Storage
      const idCardUrl = latestDocument.frontImageUrl;
      if (!idCardUrl) {
        await deleteFromBlobStorage(CONTAINERS.VIDEO, blobName);
        return res.status(400).json({
          success: false,
          message: "ID card image URL is missing",
        });
      }

      // Extract blob name from the URL
      const idCardBlobName = idCardUrl.split("/").pop();
      if (!idCardBlobName) {
        await deleteFromBlobStorage(CONTAINERS.VIDEO, blobName);
        return res.status(400).json({
          success: false,
          message: "Invalid ID card image URL format",
        });
      }

      const idCardBlobUrl = await generateSasToken(
        CONTAINERS.DOCUMENT,
        idCardBlobName
      );
      formData.append("cmnd", idCardBlobUrl, {
        filename: "id_card.jpg",
        contentType: "image/jpeg",
      });

      // Call FPT AI liveness detection API
      const fptResponse = await axios.post(
        "https://api.fpt.ai/dmp/liveness/v3",
        formData,
        {
          headers: {
            api_key: FPT_AI_API_KEY,
            ...formData.getHeaders(),
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        }
      );

      // Process FPT AI response
      if (fptResponse.status === 200 && fptResponse.data) {
        const livenessResult = fptResponse.data;

        // Update video data with liveness results
        kyc.biometricData.videoData = {
          videoUrl: blobUrl,
          verificationStatus: "verified",
          confidence: 1,
          livenessScore: 1,
          faceMatchScore: 1,
          uploadedAt: new Date(),
          fileType: videoMimeType,
          fileSize: videoFile.size,
        };

        // Mark video verification step as completed
        kyc.completedSteps.videoVerification = {
          completed: true,
          completedAt: new Date(),
          attempts: (kyc.completedSteps.videoVerification?.attempts || 0) + 1,
        };

        // If all steps are completed, update user verification status
        if (
          kyc.completedSteps.faceVerification?.completed &&
          kyc.completedSteps.documentVerification?.completed &&
          kyc.completedSteps.videoVerification?.completed
        ) {
          await User.findByIdAndUpdate(userId, {
            isVerified: true,
            verificationStatus: "approved",
          });
        }

        await kyc.save();

        res.json({
          success: true,
          data: {
            status: kyc.status,
            currentStep: kyc.currentStep,
            completedSteps: kyc.completedSteps,
          },
        });
      } else {
        // Clean up blob
        await deleteFromBlobStorage(CONTAINERS.VIDEO, blobName);
        return res.status(400).json({
          success: false,
          message: "Liveness detection failed",
        });
      }
    } catch (error) {
      // Clean up blob on error
      await deleteFromBlobStorage(CONTAINERS.VIDEO, blobName);
      throw error;
    }
  } catch (error) {
    console.error("Video upload error:", error);
    res.status(500).json({
      success: false,
      message: "Error uploading video",
      error: error.message,
    });
  }
};

// @desc    Get liveness challenge instructions
// @route   GET /api/kyc/liveness-challenge
// @access  Private
export const getLivenessChallenge = async (req, res) => {
  try {
    // Define the specific face movement actions
    const possibleActions = [
      {
        action: "FACE_STILL",
        text: "Please keep your face still and look at the camera",
      },
      { action: "TURN_LEFT", text: "Please turn your head to the left" },
      { action: "TURN_RIGHT", text: "Please turn your head to the right" },
      {
        action: "ROTATE_FACE",
        text: "Please rotate your face in a complete circle",
      },
    ];

    // Select all actions in sequence
    const selectedActions = [...possibleActions];

    // Generate a challenge ID
    const challengeId = crypto.randomBytes(16).toString("hex");

    // Store the expected action sequence for verification
    const kyc = await KYC.findOne({ userId: req.user.id });
    if (kyc) {
      kyc.livenessCheck = {
        status: "pending",
        timestamp: new Date(),
        actionSequence: selectedActions.map((action) => action.action),
        challengeId,
      };
      await kyc.save();
    }

    res.json({
      success: true,
      data: {
        challengeId,
        actions: selectedActions,
        totalActions: selectedActions.length,
      },
    });
  } catch (error) {
    console.error("Liveness challenge error:", error);
    res.status(500).json({
      success: false,
      message: "Error generating liveness challenge",
    });
  }
};

// @desc    Get KYC status and completed steps
// @route   GET /api/kyc/status
// @access  Private
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

    // Check if all steps are completed and update status if needed
    const allStepsCompleted =
      kyc.completedSteps.faceVerification?.completed &&
      kyc.completedSteps.documentVerification?.completed &&
      kyc.completedSteps.videoVerification?.completed &&
      kyc.completedSteps.voiceVerification?.completed;

    if (allStepsCompleted && kyc.status === "pending") {
      kyc.status = "approved";
      kyc.verificationHistory.push({
        action: "auto_approval",
        status: "approved",
        notes: "All verification steps completed successfully",
        timestamp: new Date(),
      });

      // Update user's verification status
      await User.findByIdAndUpdate(req.user.id, {
        isVerified: true,
        verificationStatus: "approved",
      });

      await kyc.save();
    }

    // Set KYC state in cookie
    res.cookie("kycCompletedSteps", JSON.stringify(kyc.completedSteps), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "development",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

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

export const getUserKycStatus = async (req, res) => {
  try {
    const userId = req.query.id;
    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }
    let kyc = await KYC.findOne({ userId: userId })
      .select(
        "-biometricData.faceData.imageUrl -biometricData.videoData.videoUrl -documents.frontImageUrl -documents.backImageUrl"
      )
      .sort({ createdAt: -1 });

    if (!kyc) {
      // Create new KYC application if none exists
      kyc = await KYC.create({
        userId: userId,
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

    // Check if all steps are completed and update status if needed
    const allStepsCompleted =
      kyc.completedSteps.faceVerification?.completed &&
      kyc.completedSteps.documentVerification?.completed &&
      kyc.completedSteps.videoVerification?.completed &&
      kyc.completedSteps.voiceVerification?.completed;

    if (allStepsCompleted && kyc.status === "pending") {
      kyc.status = "approved";
      kyc.verificationHistory.push({
        action: "auto_approval",
        status: "approved",
        notes: "All verification steps completed successfully",
        timestamp: new Date(),
      });

      // Update user's verification status
      await User.findByIdAndUpdate(userId, {
        isVerified: true,
        verificationStatus: "approved",
      });

      await kyc.save();
    }

    // Set KYC state in cookie
    res.cookie("kycCompletedSteps", JSON.stringify(kyc.completedSteps), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "development",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

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

// @desc    Verify KYC (Admin only)
// @route   PUT /api/kyc/verify/:id
// @access  Private/Admin
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

    // Update user's verification status based on KYC status
    await User.findByIdAndUpdate(kyc.userId, {
      isVerified: status === "approved",
      verificationStatus: status,
    });

    await kyc.save();

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

// @desc    Reset a specific KYC step (for retrying)
// @route   POST /api/kyc/reset-step
// @access  Private
export const resetKycStep = async (req, res) => {
  try {
    const { step } = req.params;
    const userId = req.user.id;

    const kyc = await KYC.findOne({ userId });
    if (!kyc) {
      return res.status(404).json({
        success: false,
        message: "KYC application not found",
      });
    }

    // Reset step data and clean up storage
    switch (step) {
      case "document":
        // Delete document files from Azure Storage
        if (kyc.documents && kyc.documents.length > 0) {
          const latestDoc = kyc.documents[kyc.documents.length - 1];
          if (latestDoc.frontImageUrl) {
            const frontBlobName = latestDoc.frontImageUrl.split("/").pop();
            await deleteFromBlobStorage(CONTAINERS.DOCUMENT, frontBlobName);
          }
          if (latestDoc.backImageUrl) {
            const backBlobName = latestDoc.backImageUrl.split("/").pop();
            await deleteFromBlobStorage(CONTAINERS.DOCUMENT, backBlobName);
          }
        }

        // Reset document data in database
        kyc.documents = [];
        kyc.completedSteps.documentVerification = {
          completed: false,
          completedAt: null,
          attempts: 0,
        };
        break;

      case "face":
        // Delete face image from Azure Storage
        if (kyc.biometricData?.faceData?.imageUrl) {
          const faceBlobName = kyc.biometricData.faceData.imageUrl
            .split("/")
            .pop();
          await deleteFromBlobStorage(CONTAINERS.FACE, faceBlobName);
        }

        // Reset face data in database
        kyc.biometricData.faceData = null;
        kyc.completedSteps.faceVerification = {
          completed: false,
          completedAt: null,
          attempts: 0,
        };
        break;

      case "video":
        // Delete video from Azure Storage
        if (kyc.biometricData?.videoData?.videoUrl) {
          const videoBlobName = kyc.biometricData.videoData.videoUrl
            .split("/")
            .pop();
          await deleteFromBlobStorage(CONTAINERS.VIDEO, videoBlobName);
        }

        // Reset video data in database
        kyc.biometricData.videoData = null;
        kyc.completedSteps.videoVerification = {
          completed: false,
          completedAt: null,
          attempts: 0,
        };
        break;

      case "voice":
        // Delete voice sample from Azure Storage
        if (kyc.biometricData?.voiceData?.audioUrl) {
          const voiceBlobName = kyc.biometricData.voiceData.audioUrl
            .split("/")
            .pop();
          await deleteFromBlobStorage(CONTAINERS.VOICE, voiceBlobName);
        }

        // Reset voice data in database
        kyc.biometricData.voiceData = null;
        kyc.completedSteps.voiceVerification = {
          completed: false,
          completedAt: null,
          attempts: 0,
        };
        break;

      default:
        return res.status(400).json({
          success: false,
          message: "Invalid step specified",
        });
    }

    // Update current step if needed
    if (kyc.currentStep === step) {
      // Find the next incomplete step
      const steps = ["document", "face", "video", "voice"];
      const currentIndex = steps.indexOf(step);
      const nextStep = steps
        .slice(currentIndex + 1)
        .find((s) => !kyc.completedSteps[`${s}Verification`]?.completed);
      kyc.currentStep = nextStep || step;
    }

    // Reset user verification status if needed
    if (
      !kyc.completedSteps.documentVerification?.completed ||
      !kyc.completedSteps.faceVerification?.completed ||
      !kyc.completedSteps.videoVerification?.completed ||
      !kyc.completedSteps.voiceVerification?.completed
    ) {
      await User.findByIdAndUpdate(userId, {
        isVerified: false,
        verificationStatus: "pending",
      });
    }

    await kyc.save();

    res.json({
      success: true,
      data: {
        status: kyc.status,
        currentStep: kyc.currentStep,
        completedSteps: kyc.completedSteps,
      },
    });
  } catch (error) {
    console.error("Reset KYC step error:", error);
    res.status(500).json({
      success: false,
      message: "Error resetting KYC step",
      error: error.message,
    });
  }
};

// @desc    Get all KYC applications (Admin only)
// @route   GET /api/kyc/all
// @access  Private/Admin
export const getAllKYC = async (req, res) => {
  try {
    const kycList = await KYC.find()
      .populate("userId", "email firstName lastName")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: kycList,
    });
  } catch (error) {
    console.error("Get all KYC error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching KYC applications",
    });
  }
};

// @desc    Upload voice sample for verification
// @route   POST /api/kyc/voice
// @access  Private
export const uploadVoiceSample = async (req, res) => {
  try {
    const voiceFile = req.files?.voiceSample?.[0];
    const { text } = req.body; // The text that should be spoken in the recording

    if (!voiceFile || !text) {
      if (voiceFile) await deleteFile(voiceFile.path);
      return res.status(400).json({
        success: false,
        message: "Missing voice sample or text",
      });
    }

    // Validate file type
    const allowedTypes = ["audio/wav", "audio/mpeg", "audio/mp4"];
    if (!allowedTypes.includes(voiceFile.mimetype)) {
      await deleteFile(voiceFile.path);
      return res.status(400).json({
        success: false,
        message: "Invalid file type. Allowed types: WAV, MP3, M4A",
      });
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (voiceFile.size > maxSize) {
      await deleteFile(voiceFile.path);
      return res.status(400).json({
        success: false,
        message: "File too large. Maximum size: 10MB",
      });
    }

    // Find existing KYC application
    const kyc = await KYC.findOne({ userId: req.user.id });
    if (!kyc) {
      await deleteFile(voiceFile.path);
      return res.status(404).json({
        success: false,
        message: "KYC application not found",
      });
    }

    // Generate a unique blob name
    const fileExtension = path.extname(voiceFile.originalname);
    const blobName = `${req.user.id}-voice-${Date.now()}${fileExtension}`;

    // Upload the file to Azure Blob Storage
    const blobUrl = await uploadToBlobStorage(
      voiceFile.buffer,
      CONTAINERS.VOICE,
      blobName
    );

    // Update voice data
    kyc.biometricData.voiceData = {
      audioUrl: blobUrl,
      verificationStatus: "pending",
      uploadedAt: new Date(),
      fileType: voiceFile.mimetype,
      fileSize: voiceFile.size,
      // These would be populated by the voice processing service
      duration: 0,
      sampleRate: 0,
      channels: 0,
    };

    // TODO: Process voice sample with voice biometric service
    // This would be implemented with your chosen voice biometric provider
    // For now, we'll simulate a successful verification
    kyc.biometricData.voiceData.verificationStatus = "verified";
    kyc.biometricData.voiceData.confidence = 0.95;
    kyc.biometricData.voiceData.livenessScore = 0.98;

    await kyc.save();

    res.status(200).json({
      success: true,
      data: {
        kycId: kyc._id,
        voiceVerification: kyc.biometricData.voiceData,
      },
    });
  } catch (error) {
    console.error("Voice sample upload error:", error);
    if (req.files?.voiceSample?.[0]?.path) {
      await deleteFile(req.files.voiceSample[0].path);
    }
    res.status(500).json({
      success: false,
      message: "Error uploading voice sample",
    });
  }
};

// @desc    Verify voice sample
// @route   POST /api/kyc/voice/verify
// @access  Private
export const verifyVoiceSample = async (req, res) => {
  try {
    const { kycId } = req.params;
    const voiceFile = req.files?.voiceSample?.[0];

    if (!voiceFile) {
      return res.status(400).json({
        success: false,
        message: "No voice sample provided",
      });
    }

    const kyc = await KYC.findOne({ _id: kycId, userId: req.user.id });
    if (!kyc) {
      await deleteFile(voiceFile.path);
      return res.status(404).json({
        success: false,
        message: "KYC application not found",
      });
    }

    // TODO: Implement voice verification logic
    // This would compare the new voice sample with the stored template
    // For now, we'll simulate a successful verification
    const verificationResult = {
      success: true,
      confidence: 0.92,
      livenessScore: 0.95,
    };

    // Update verification history
    kyc.verificationHistory.push({
      action: "voice_verification",
      status: verificationResult.success ? "success" : "failed",
      notes: `Voice verification ${
        verificationResult.success ? "successful" : "failed"
      }`,
    });

    await kyc.save();

    res.status(200).json({
      success: true,
      data: {
        verificationResult,
        kycId: kyc._id,
      },
    });
  } catch (error) {
    console.error("Voice verification error:", error);
    if (req.files?.voiceSample?.[0]?.path) {
      await deleteFile(req.files.voiceSample[0].path);
    }
    res.status(500).json({
      success: false,
      message: "Error verifying voice sample",
    });
  }
};

// @desc    Process speech recognition for KYC
// @route   POST /api/kyc/speech
// @access  Private
export const processSpeechRecognition = async (req, res) => {
  let audioFile = null;
  let outputPath = null;
  let inputPath = null;

  try {
    audioFile = req.file;
    const { expectedText } = req.body;

    if (!audioFile || !expectedText) {
      return res.status(400).json({
        success: false,
        message: "Missing audio file or expected text",
      });
    }

    // Log the file object for debugging
    console.log("Uploaded file:", {
      fieldname: audioFile.fieldname,
      originalname: audioFile.originalname,
      encoding: audioFile.encoding,
      mimetype: audioFile.mimetype,
      buffer: audioFile.buffer ? "Buffer present" : "No buffer",
      size: audioFile.size,
      path: audioFile.path,
    });

    // Validate file type - only allow WAV for consistency
    if (audioFile.mimetype !== "audio/wav") {
      return res.status(400).json({
        success: false,
        message: "Only WAV audio files are allowed",
      });
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (audioFile.size > maxSize) {
      return res.status(400).json({
        success: false,
        message: "File too large. Maximum size: 10MB",
      });
    }

    // Find existing KYC application
    const kyc = await KYC.findOne({ userId: req.user.id });
    if (!kyc) {
      return res.status(404).json({
        success: false,
        message: "KYC application not found",
      });
    }

    // Create temp directory if it doesn't exist
    const tempDir = path.join(process.cwd(), "uploads", "temp");
    await fs.promises.mkdir(tempDir, { recursive: true });

    // Generate unique filenames
    const timestamp = Date.now();
    inputPath = path.join(tempDir, `input-${timestamp}.wav`);
    outputPath = path.join(tempDir, `output-${timestamp}.wav`);

    // Write the buffer to a temporary file
    try {
      await fs.promises.writeFile(inputPath, audioFile.buffer);
      console.log("Successfully wrote input file to:", inputPath);
    } catch (error) {
      console.error("Error writing input file:", error);
      return res.status(500).json({
        success: false,
        message: "Error processing audio file",
      });
    }

    // Convert audio to WAV format with specific parameters for Azure Speech
    try {
      await new Promise((resolve, reject) => {
        const ffmpegCommand = ffmpeg(inputPath)
          .setFfmpegPath(ffmpegStatic)
          .audioChannels(1) // Mono audio
          .audioFrequency(16000) // 16kHz sample rate
          .audioCodec("pcm_s16le") // 16-bit PCM
          .format("wav") // Explicitly set format to WAV
          .outputOptions([
            "-acodec pcm_s16le", // 16-bit PCM
            "-ar 16000", // 16kHz sample rate
            "-ac 1", // Mono
            "-f wav", // Force WAV format
          ]);

        // Add detailed error logging
        ffmpegCommand.on("start", (commandLine) => {
          console.log("FFmpeg command:", commandLine);
        });

        ffmpegCommand.on("error", (err, stdout, stderr) => {
          console.error("FFmpeg error:", err);
          console.error("FFmpeg stderr:", stderr);
          reject(err);
        });

        ffmpegCommand.on("end", () => {
          console.log("FFmpeg conversion completed");
          resolve();
        });

        ffmpegCommand.save(outputPath);
      });

      // Verify the WAV file exists and has content
      const stats = await fs.promises.stat(outputPath);
      if (stats.size === 0) {
        throw new Error("Generated WAV file is empty");
      }
      console.log("Output WAV file size:", stats.size);
    } catch (error) {
      console.error("Error converting audio:", error);
      // Clean up files
      if (inputPath && fs.existsSync(inputPath)) {
        await deleteFile(inputPath);
      }
      if (outputPath && fs.existsSync(outputPath)) {
        await deleteFile(outputPath);
      }
      return res.status(500).json({
        success: false,
        message: "Error converting audio format. Please ensure the audio file is valid.",
      });
    }

    // Check Azure Speech configuration
    if (!AZURE_SPEECH_KEY || !AZURE_SPEECH_REGION) {
      console.error("Azure Speech configuration missing");
      return res.status(500).json({
        success: false,
        message: "Azure Speech configuration is missing",
      });
    }

    // Configure Azure Speech Service
    const speechConfig = sdk.SpeechConfig.fromSubscription(
      AZURE_SPEECH_KEY,
      AZURE_SPEECH_REGION
    );
    speechConfig.speechRecognitionLanguage = "en-US";

    // Read the WAV file into a buffer
    const wavBuffer = await fs.promises.readFile(outputPath);
    console.log("Read WAV file into buffer, size:", wavBuffer.length);

    // Create audio config from buffer
    const audioConfig = sdk.AudioConfig.fromWavFileInput(wavBuffer);

    // Create speech recognizer
    const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

    // Process speech recognition
    console.log("Starting speech recognition...");
    const result = await new Promise((resolve, reject) => {
      recognizer.recognizeOnceAsync(
        (result) => {
          console.log("Speech recognition result:", result);
          resolve(result);
        },
        (error) => {
          console.error("Speech recognition error:", error);
          reject(error);
        }
      );
    });

    // Get recognized text and normalize it (remove punctuation and extra spaces)
    const normalizeText = (text) => {
      return text
        .toLowerCase()
        .replace(/[.,!?]/g, '') // Remove punctuation
        .replace(/\s+/g, ' ')   // Replace multiple spaces with single space
        .trim();                // Remove leading/trailing spaces
    };

    const recognizedText = normalizeText(result.text);
    const expectedTextLower = normalizeText(expectedText);
    console.log("Recognized text (normalized):", recognizedText);
    console.log("Expected text (normalized):", expectedTextLower);

    // Calculate similarity score (simple exact match for now)
    const isMatch = recognizedText === expectedTextLower;
    const confidence = result.confidence || 0;
    console.log("Match result:", { isMatch, confidence });

    // Check if this is the first voice recording
    const isFirstRecording = !kyc.biometricData.voiceData?.audioUrl;
    console.log("Is first recording:", isFirstRecording);

    // Update KYC with speech recognition results
    if (!kyc.biometricData.voiceData) {
      kyc.biometricData.voiceData = {};
    }

    // Only proceed with updates if there's a match
    if (isMatch) {
      try {
        // Generate unique blob name
        const blobName = `${kyc._id}-${Date.now()}.wav`;
        console.log("Uploading to Azure Blob Storage:", blobName);

        // Upload to Azure Blob Storage
        const blobUrl = await uploadToBlobStorage(
          wavBuffer,
          CONTAINERS.VOICE,
          blobName,
          "audio/wav"
        );
        console.log("Uploaded to Azure Blob Storage:", blobUrl);

        // Update voice data with successful match
        kyc.biometricData.voiceData = {
          ...kyc.biometricData.voiceData,
          audioUrl: blobUrl,
          verificationStatus: "verified",
          confidence: confidence,
          recognizedText: recognizedText,
          expectedText: expectedText,
          processedAt: new Date(),
          fileType: "audio/wav",
          fileSize: wavBuffer.length,
          uploadedAt: new Date()
        };

        // Update voice verification step only if this is a verification attempt
        if (!isFirstRecording) {
          kyc.completedSteps.voiceVerification = {
            completed: true,
            completedAt: new Date(),
            attempts: (kyc.completedSteps.voiceVerification?.attempts || 0) + 1,
          };

          // Check if all steps are completed
          const allStepsCompleted = 
            kyc.completedSteps.faceVerification?.completed &&
            kyc.completedSteps.documentVerification?.completed &&
            kyc.completedSteps.videoVerification?.completed &&
            kyc.completedSteps.voiceVerification?.completed;

          if (allStepsCompleted) {
            // Update KYC status
            kyc.status = "approved";
            kyc.verificationHistory.push({
              action: "auto_approval",
              status: "approved",
              notes: "All verification steps completed successfully",
              timestamp: new Date(),
            });

            // Update user's verification status
            await User.findByIdAndUpdate(req.user.id, {
              isVerified: true,
              verificationStatus: "approved",
            });
          }
        }

        // Add to verification history
        kyc.verificationHistory.push({
          action: isFirstRecording ? "voice_template_creation" : "speech_recognition",
          status: "success",
          notes: isFirstRecording
            ? "Initial voice template created successfully"
            : `Speech recognition successful. Confidence: ${confidence}`,
          timestamp: new Date(),
        });

        // Save KYC updates
        try {
          await kyc.save();
          console.log("KYC updated successfully");
        } catch (error) {
          console.error("Error saving KYC:", error);
          return res.status(500).json({
            success: false,
            message: "Error updating KYC record",
          });
        }
      } catch (error) {
        console.error("Error saving voice template:", error);
        return res.status(500).json({
          success: false,
          message: "Error saving voice template",
        });
      }
    } else {
      // For failed matches, only update the verification status and increment attempts
      kyc.biometricData.voiceData = {
        ...kyc.biometricData.voiceData,
        verificationStatus: "rejected",
        confidence: confidence,
        recognizedText: recognizedText,
        expectedText: expectedText,
        processedAt: new Date()
      };

      // Increment attempts counter
      if (!kyc.completedSteps.voiceVerification) {
        kyc.completedSteps.voiceVerification = {
          completed: false,
          attempts: 1
        };
      } else {
        kyc.completedSteps.voiceVerification.attempts = 
          (kyc.completedSteps.voiceVerification.attempts || 0) + 1;
      }

      // Add failed attempt to verification history
      kyc.verificationHistory.push({
        action: "speech_recognition",
        status: "failed",
        notes: `Speech recognition failed. Expected: "${expectedText}", Got: "${recognizedText}". Confidence: ${confidence}`,
        timestamp: new Date(),
      });

      // Save the failed attempt
      try {
        await kyc.save();
        console.log("KYC updated with failed attempt");
      } catch (error) {
        console.error("Error saving KYC:", error);
        return res.status(500).json({
          success: false,
          message: "Error updating KYC record",
        });
      }
    }

    // Update KYC state in cookie
    res.cookie("kycCompletedSteps", JSON.stringify(kyc.completedSteps), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "development",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Clean up the temporary files after everything is done
    try {
      if (inputPath && fs.existsSync(inputPath)) {
        await deleteFile(inputPath);
      }
      if (outputPath && fs.existsSync(outputPath)) {
        await deleteFile(outputPath);
      }
    } catch (error) {
      console.error("Error cleaning up temporary files:", error);
    }

    res.status(200).json({
      success: true,
      data: {
        isMatch,
        confidence,
        recognizedText,
        expectedText,
        verificationStatus: kyc.biometricData.voiceData.verificationStatus,
        completedSteps: kyc.completedSteps,
        currentStep: kyc.getNextIncompleteStep(),
        isFirstRecording,
      },
    });
  } catch (error) {
    console.error("Speech recognition error:", error);
    // Clean up files in case of error
    try {
      if (inputPath && fs.existsSync(inputPath)) {
        await deleteFile(inputPath);
      }
      if (outputPath && fs.existsSync(outputPath)) {
        await deleteFile(outputPath);
      }
    } catch (cleanupError) {
      console.error("Error cleaning up files:", cleanupError);
    }
    res.status(500).json({
      success: false,
      message: "Error processing speech recognition",
      error: error.message,
    });
  }
};
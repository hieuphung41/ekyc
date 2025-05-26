import KYC from "../models/KYC.js";
import User from "../models/User.js";
import { uploadMiddleware, deleteFile } from "../utils/fileUpload.js";
import crypto from "crypto";
import path from "path";
import fs from "fs/promises";

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
    const secureFilename = `${crypto
      .randomBytes(16)
      .toString("hex")}${fileExtension}`;

    // Create secure storage path
    const storageDir = path.join(process.cwd(), "storage", "biometric", "face");
    await fs.mkdir(storageDir, { recursive: true });

    // Move file to secure location
    const securePath = path.join(storageDir, secureFilename);
    await fs.rename(file.path, securePath);

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

    // Update KYC state in cookie
    res.cookie('kycCompletedSteps', JSON.stringify(kyc.completedSteps), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'development',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
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
    const { documentType } = req.body;
    const frontImage = req.files?.frontImage?.[0];
    const backImage = req.files?.backImage?.[0];

    if (!documentType || !frontImage || !backImage) {
      // Clean up any uploaded files if validation fails
      if (frontImage) await deleteFile(frontImage.path);
      if (backImage) await deleteFile(backImage.path);
      return res.status(400).json({
        success: false,
        message: "Missing required fields or files",
      });
    }

    // Validate document type
    const allowedTypes = ["passport", "nationalId", "drivingLicense"];
    if (!allowedTypes.includes(documentType)) {
      await deleteFile(frontImage.path);
      await deleteFile(backImage.path);
      return res.status(400).json({
        success: false,
        message: "Invalid document type",
      });
    }

    // Validate file types
    const allowedImageTypes = ["image/jpeg", "image/png"];
    if (
      !allowedImageTypes.includes(frontImage.mimetype) ||
      !allowedImageTypes.includes(backImage.mimetype)
    ) {
      await deleteFile(frontImage.path);
      await deleteFile(backImage.path);
      return res.status(400).json({
        success: false,
        message: "Invalid file type. Only JPEG and PNG are allowed",
      });
    }

    // Validate file sizes (max 10MB each)
    const maxSize = 10 * 1024 * 1024;
    if (frontImage.size > maxSize || backImage.size > maxSize) {
      await deleteFile(frontImage.path);
      await deleteFile(backImage.path);
      return res.status(400).json({
        success: false,
        message: "File too large. Maximum size: 10MB",
      });
    }

    // Find existing KYC application
    let kyc = await KYC.findOne({ userId: req.user.id });
    if (!kyc) {
      await deleteFile(frontImage.path);
      await deleteFile(backImage.path);
      return res.status(404).json({
        success: false,
        message: "KYC application not found",
      });
    }

    // Generate secure filenames
    const frontExtension = path.extname(frontImage.originalname);
    const backExtension = path.extname(backImage.originalname);
    const frontFilename = `${crypto
      .randomBytes(16)
      .toString("hex")}${frontExtension}`;
    const backFilename = `${crypto
      .randomBytes(16)
      .toString("hex")}${backExtension}`;

    // Create secure storage paths
    const storageDir = path.join(process.cwd(), "storage", "documents");
    await fs.mkdir(storageDir, { recursive: true });

    const frontPath = path.join(storageDir, frontFilename);
    const backPath = path.join(storageDir, backFilename);

    // Move files to secure location
    await fs.rename(frontImage.path, frontPath);
    await fs.rename(backImage.path, backPath);

    // Parse OCR data from request body
    let ocrData = null;
    if (req.body.ocrData) {
      try {
        ocrData = JSON.parse(req.body.ocrData);
      } catch (error) {
        console.error("Error parsing ocrData:", error);
        // Optionally, return an error to the client if ocrData is required
      }
    }

    // Update document record
    const documentData = {
      type: documentType,
      frontImageUrl: frontPath,
      backImageUrl: backPath,
      verificationStatus: "pending",
      uploadedAt: new Date(),
      ocrResult: ocrData, // Save the parsed OCR data
    };

    // If document already exists, update it; otherwise add new
    if (kyc.documents && kyc.documents.length > 0) {
      // Delete old files if they exist
      if (kyc.documents[0].frontImageUrl)
        await deleteFile(kyc.documents[0].frontImageUrl);
      if (kyc.documents[0].backImageUrl)
        await deleteFile(kyc.documents[0].backImageUrl);

      kyc.documents[0] = documentData;
    } else {
      kyc.documents = [documentData];
    }

    // Mark document verification step as pending
    kyc.completedSteps.documentVerification = {
      completed: false,
      attempts: (kyc.completedSteps.documentVerification?.attempts || 0) + 1,
    };

    // Update current step
    kyc.updateCurrentStep();

    await kyc.save();

    res.status(200).json({
      success: true,
      data: {
        documentType,
        verificationStatus: "pending",
        currentStep: kyc.currentStep,
        completedSteps: kyc.completedSteps,
      },
    });
  } catch (error) {
    console.error("Document upload error:", error);
    // Clean up files if they exist
    if (req.files?.frontImage?.[0]?.path)
      await deleteFile(req.files.frontImage[0].path);
    if (req.files?.backImage?.[0]?.path)
      await deleteFile(req.files.backImage[0].path);
    res.status(500).json({
      success: false,
      message: "Error uploading document images",
    });
  }
};

// @desc    Upload video for verification
// @route   POST /api/kyc/video
// @access  Private
export const uploadVideo = async (req, res) => {
  try {
    const { idNumber, idType, completedActions } = req.body;
    const videoFile = req.file;

    if (!videoFile || !idNumber || !idType) {
      if (videoFile) await deleteFile(videoFile.path);
      return res.status(400).json({
        success: false,
        message: "Missing required fields or video file",
      });
    }

    // Validate file type
    const allowedTypes = ["video/webm", "video/mp4"];
    if (!allowedTypes.includes(videoFile.mimetype)) {
      await deleteFile(videoFile.path);
      return res.status(400).json({
        success: false,
        message: "Invalid file type. Only WebM and MP4 are allowed",
      });
    }

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024;
    if (videoFile.size > maxSize) {
      await deleteFile(videoFile.path);
      return res.status(400).json({
        success: false,
        message: "File too large. Maximum size: 50MB",
      });
    }

    // Find existing KYC application
    let kyc = await KYC.findOne({ userId: req.user.id });
    if (!kyc) {
      await deleteFile(videoFile.path);
      return res.status(404).json({
        success: false,
        message: "KYC application not found",
      });
    }

    // Generate secure filename
    const fileExtension = path.extname(videoFile.originalname);
    const secureFilename = `${crypto
      .randomBytes(16)
      .toString("hex")}${fileExtension}`;

    // Create secure storage path
    const storageDir = path.join(
      process.cwd(),
      "storage",
      "biometric",
      "video"
    );
    await fs.mkdir(storageDir, { recursive: true });

    // Move file to secure location
    const securePath = path.join(storageDir, secureFilename);
    await fs.rename(videoFile.path, securePath);

    // Update video data
    kyc.biometricData.videoData = {
      videoUrl: securePath,
      verificationStatus: "pending",
      uploadedAt: new Date(),
      fileType: videoFile.mimetype,
      fileSize: videoFile.size,
      completedActions: completedActions ? JSON.parse(completedActions) : [],
    };

    // Update personal info
    if (!kyc.personalInfo) {
      kyc.personalInfo = {};
    }
    kyc.personalInfo.idNumber = idNumber;
    kyc.personalInfo.idType = idType;

    // Mark video verification step as completed
    kyc.completedSteps.videoVerification = {
      completed: true,
      completedAt: new Date(),
      attempts: (kyc.completedSteps.videoVerification?.attempts || 0) + 1,
    };

    // Update current step
    kyc.updateCurrentStep();

    // If all steps are completed, change status to pending review
    if (
      kyc.completedSteps.faceVerification?.completed &&
      kyc.completedSteps.documentVerification?.completed &&
      kyc.completedSteps.videoVerification?.completed
    ) {
      kyc.status = "pending";
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
    console.error("Video upload error:", error);
    if (req.file?.path) {
      await deleteFile(req.file.path);
    }
    res.status(500).json({
      success: false,
      message: "Error uploading video",
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
        },
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year expiry
      });
    }

    // Set KYC state in cookie
    res.cookie('kycCompletedSteps', JSON.stringify(kyc.completedSteps), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'development',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      success: true,
      data: {
        status: kyc.status,
        completedSteps: kyc.completedSteps,
        documents: kyc.documents,
        personalInfo: kyc.personalInfo,
        livenessCheck: kyc.livenessCheck,
        expiryDate: kyc.expiryDate,
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
    const { step } = req.body;

    if (
      !step ||
      ![
        "faceVerification",
        "documentVerification",
        "videoVerification",
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

    // Update KYC state in cookie
    res.cookie('kycCompletedSteps', JSON.stringify(kyc.completedSteps), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'development',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

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

    // Generate secure filename
    const fileExtension = path.extname(voiceFile.originalname);
    const secureFilename = `${crypto
      .randomBytes(16)
      .toString("hex")}${fileExtension}`;

    // Create secure storage path
    const storageDir = path.join(
      process.cwd(),
      "storage",
      "biometric",
      "voice"
    );
    await fs.mkdir(storageDir, { recursive: true });

    // Move file to secure location
    const securePath = path.join(storageDir, secureFilename);
    await fs.rename(voiceFile.path, securePath);

    // Update voice data
    kyc.biometricData.voiceData = {
      audioUrl: securePath,
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

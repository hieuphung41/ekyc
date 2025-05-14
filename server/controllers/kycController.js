import KYC from "../models/KYC.js";
import User from "../models/User.js";
import { uploadMiddleware, deleteFile } from "../utils/fileUpload.js";
import crypto from "crypto";
import path from "path";
import fs from "fs/promises";

// @desc    Submit KYC application
// @route   POST /api/kyc/submit
// @access  Private
export const submitKYC = async (req, res) => {
  try {
    const { idNumber, idType } = req.body;
    const faceVideo = req.files?.faceVideo?.[0];

    if (!idNumber || !idType || !faceVideo) {
      if (faceVideo) await deleteFile(faceVideo.path);
      return res.status(400).json({
        success: false,
        message: "Missing required fields or files",
      });
    }

    // Check if user already has a KYC application
    let existingKYC = await KYC.findOne({
      userId: req.user.id,
    });

    // If KYC exists and is approved, don't allow a new submission
    if (existingKYC && existingKYC.status === "approved") {
      if (faceVideo) await deleteFile(faceVideo.path);
      return res.status(400).json({
        success: false,
        message: "You already have an approved KYC application",
      });
    }

    // Process video file
    let videoPath = null;
    if (faceVideo) {
      // Generate secure filename for video
      const fileExtension = path.extname(faceVideo.originalname);
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
      videoPath = path.join(storageDir, secureFilename);
      await fs.rename(faceVideo.path, videoPath);
    }

    // If existing KYC is found, update it; otherwise create new
    if (existingKYC) {
      // Update existing KYC with video data
      existingKYC.documents =
        existingKYC.documents && existingKYC.documents.length > 0
          ? existingKYC.documents
          : [
              {
                type: idType,
                documentNumber: idNumber,
              },
            ];

      // Update biometric video data
      existingKYC.biometricData.videoData = {
        videoUrl: videoPath,
        verificationStatus: "pending",
        uploadedAt: new Date(),
        fileType: faceVideo.mimetype,
        fileSize: faceVideo.size,
      };

      // Mark video verification step as completed
      existingKYC.completedSteps.videoVerification = {
        completed: true,
        completedAt: new Date(),
        attempts:
          (existingKYC.completedSteps.videoVerification.attempts || 0) + 1,
      };

      // Update currentStep
      existingKYC.updateCurrentStep();

      // If all steps are completed, change status to pending review
      if (
        existingKYC.completedSteps.faceVerification.completed &&
        existingKYC.completedSteps.documentVerification.completed &&
        existingKYC.completedSteps.videoVerification.completed
      ) {
        existingKYC.status = "pending";
      }

      await existingKYC.save();

      return res.status(200).json({
        success: true,
        data: {
          kycId: existingKYC._id,
          currentStep: existingKYC.currentStep,
          completedSteps: existingKYC.completedSteps,
          status: existingKYC.status,
        },
      });
    } else {
      // Create new KYC application
      const kyc = await KYC.create({
        userId: req.user.id,
        documents: [
          {
            type: idType,
            documentNumber: idNumber,
          },
        ],
        biometricData: {
          videoData: {
            videoUrl: videoPath,
            verificationStatus: "pending",
            uploadedAt: new Date(),
            fileType: faceVideo.mimetype,
            fileSize: faceVideo.size,
          },
        },
        completedSteps: {
          videoVerification: {
            completed: true,
            completedAt: new Date(),
            attempts: 1,
          },
        },
        currentStep: 3, // Still need to complete other steps
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year expiry
      });

      res.status(201).json({
        success: true,
        data: {
          kycId: kyc._id,
          currentStep: kyc.currentStep,
          completedSteps: kyc.completedSteps,
          status: kyc.status,
        },
      });
    }
  } catch (error) {
    console.error("KYC submission error:", error);
    // Clean up files if they exist
    if (req.files?.faceVideo?.[0]?.path) {
      await deleteFile(req.files.faceVideo[0].path);
    }
    res.status(500).json({
      success: false,
      message: "Error submitting KYC application",
    });
  }
};

// @desc    Upload biometric data
// @route   POST /api/kyc/biometric
// @access  Private
export const uploadBiometric = async (req, res) => {
  try {
    const { type, faceMetadata } = req.body; // 'face' or 'idCard'
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    // Validate file type
    const allowedTypes = {
      face: ["image/jpeg", "image/png"],
      idCard: ["image/jpeg", "image/png"],
    };

    if (!allowedTypes[type]?.includes(file.mimetype)) {
      await deleteFile(file.path);
      return res.status(400).json({
        success: false,
        message: `Invalid file type. Allowed types for ${type}: ${allowedTypes[
          type
        ]?.join(", ")}`,
      });
    }

    // Validate file size
    const maxSizes = {
      face: 5 * 1024 * 1024, // 5MB
      idCard: 10 * 1024 * 1024, // 10MB
    };

    if (file.size > maxSizes[type]) {
      await deleteFile(file.path);
      return res.status(400).json({
        success: false,
        message: `File too large. Maximum size for ${type}: ${
          maxSizes[type] / (1024 * 1024)
        }MB`,
      });
    }

    // Find existing KYC application or create a new one
    let kyc = await KYC.findOne({
      userId: req.user.id,
    });

    if (!kyc) {
      kyc = await KYC.create({
        userId: req.user.id,
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year expiry
      });
    } else if (kyc.status === "approved") {
      // Don't allow updates to approved KYC applications
      await deleteFile(file.path);
      return res.status(400).json({
        success: false,
        message: "KYC application is already approved and cannot be modified",
      });
    }

    // Generate secure filename
    const fileExtension = path.extname(file.originalname);
    const secureFilename = `${crypto
      .randomBytes(16)
      .toString("hex")}${fileExtension}`;

    // Create secure storage path
    const storageDir = path.join(process.cwd(), "storage", "biometric", type);
    await fs.mkdir(storageDir, { recursive: true });

    // Move file to secure location
    const securePath = path.join(storageDir, secureFilename);
    await fs.rename(file.path, securePath);

    // Update biometric data based on type
    if (type === "face") {
      // Delete old file if exists
      if (kyc.biometricData.faceData?.imageUrl) {
        await deleteFile(kyc.biometricData.faceData.imageUrl);
      }

      // Process face metadata if available
      let livenessScore = 0;
      let confidence = 0;

      if (faceMetadata) {
        try {
          const metadata = JSON.parse(faceMetadata);
          confidence = metadata.confidence || 0;

          // Simulate liveness detection here
          // In a real implementation, you would call a liveness detection API
          livenessScore = Math.random() * 0.5 + 0.5; // Random score between 0.5 and 1.0

          // Update liveness check status
          kyc.livenessCheck = {
            status: livenessScore > 0.7 ? "passed" : "failed",
            timestamp: new Date(),
            score: livenessScore,
          };
        } catch (e) {
          console.error("Error parsing face metadata:", e);
        }
      }

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
      if (livenessScore > 0.7) {
        kyc.completedSteps.faceVerification = {
          completed: true,
          completedAt: new Date(),
          attempts: (kyc.completedSteps.faceVerification.attempts || 0) + 1,
        };
      }
    } else if (type === "idCard") {
      // For ID card, we might want to perform OCR
      // Delete old file if exists
      if (kyc.documents?.[0]?.frontImageUrl) {
        await deleteFile(kyc.documents[0].frontImageUrl);
      }

      // In a real implementation, you would call an OCR API here
      // For now, we'll just store the image
      if (!kyc.documents || kyc.documents.length === 0) {
        kyc.documents = [
          {
            type: "nationalId", // Default type if not specified
            frontImageUrl: securePath,
            verificationStatus: "pending",
          },
        ];
      } else {
        kyc.documents[0].frontImageUrl = securePath;
        kyc.documents[0].verificationStatus = "pending";
      }

      // The OCR step won't mark as complete yet - that happens in the processOCR method
    }

    // Update current step based on completed steps
    kyc.updateCurrentStep();

    // If all steps are completed, change status to pending review
    if (
      kyc.completedSteps.faceVerification.completed &&
      kyc.completedSteps.documentVerification.completed &&
      kyc.completedSteps.videoVerification.completed
    ) {
      kyc.status = "pending";
    }

    await kyc.save();

    res.json({
      success: true,
      data: {
        type,
        status: "pending",
        uploadedAt: new Date(),
        livenessScore:
          type === "face"
            ? kyc.biometricData.faceData.livenessScore
            : undefined,
        currentStep: kyc.currentStep,
        completedSteps: kyc.completedSteps,
      },
    });
  } catch (error) {
    console.error("Biometric upload error:", error);
    // Clean up file if it exists
    if (req.file?.path) {
      await deleteFile(req.file.path);
    }
    res.status(500).json({
      success: false,
      message: "Error uploading biometric data",
    });
  }
};

// @desc    Process OCR for ID card
// @route   POST /api/kyc/ocr
// @access  Private
export const processOCR = async (req, res) => {
  try {
    const { documentId } = req.body;

    // Find the KYC record
    const kyc = await KYC.findOne({
      userId: req.user.id,
    });

    if (!kyc || !kyc.documents || kyc.documents.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No KYC application or documents found",
      });
    }

    if (kyc.status === "approved") {
      return res.status(400).json({
        success: false,
        message: "KYC application is already approved and cannot be modified",
      });
    }

    // In a real implementation, you would retrieve OCR results from a service
    // For now, we'll return mockup data
    const ocrResults = {
      documentNumber: "OCR-123456789",
      name: "John Doe",
      dateOfBirth: "1990-01-01",
      issueDate: "2020-01-01",
      expiryDate: "2030-01-01",
      issuingCountry: "USA",
    };

    // Update document with OCR results
    kyc.documents[0].documentNumber = ocrResults.documentNumber;
    kyc.documents[0].issueDate = new Date(ocrResults.issueDate);
    kyc.documents[0].expiryDate = new Date(ocrResults.expiryDate);
    kyc.documents[0].issuingCountry = ocrResults.issuingCountry;

    // Store OCR data
    kyc.documents[0].ocrData = {
      extractedFields: ocrResults,
      confidence: 0.95, // Simulated confidence score
      processedAt: new Date(),
    };

    // Update personal info
    if (!kyc.personalInfo) {
      kyc.personalInfo = {};
    }
    kyc.personalInfo.dateOfBirth = new Date(ocrResults.dateOfBirth);

    // Mark document verification step as completed
    kyc.completedSteps.documentVerification = {
      completed: true,
      completedAt: new Date(),
      attempts: (kyc.completedSteps.documentVerification.attempts || 0) + 1,
    };

    // Update current step
    kyc.updateCurrentStep();

    // If all steps are completed, change status to pending review
    if (
      kyc.completedSteps.faceVerification.completed &&
      kyc.completedSteps.documentVerification.completed &&
      kyc.completedSteps.videoVerification.completed
    ) {
      kyc.status = "pending";
    }

    await kyc.save();

    res.json({
      success: true,
      data: {
        ...ocrResults,
        currentStep: kyc.currentStep,
        completedSteps: kyc.completedSteps,
      },
    });
  } catch (error) {
    console.error("OCR processing error:", error);
    res.status(500).json({
      success: false,
      message: "Error processing OCR",
    });
  }
};

// @desc    Get liveness challenge instructions
// @route   GET /api/kyc/liveness-challenge
// @access  Private
export const getLivenessChallenge = async (req, res) => {
  try {
    // Generate random liveness challenges
    const possibleActions = [
      { action: "TURN_LEFT", text: "Please turn your head to the left" },
      { action: "TURN_RIGHT", text: "Please turn your head to the right" },
      { action: "NOD", text: "Please nod your head up and down" },
      { action: "SMILE", text: "Please smile" },
      { action: "BLINK", text: "Please blink your eyes" },
      { action: "OPEN_MOUTH", text: "Please open your mouth" },
    ];

    // Select 3 random actions
    const selectedActions = [];
    const actionCount = Math.min(3, possibleActions.length);

    while (selectedActions.length < actionCount) {
      const randomIndex = Math.floor(Math.random() * possibleActions.length);
      const action = possibleActions[randomIndex];

      // Check if this action is already selected
      if (!selectedActions.find((a) => a.action === action.action)) {
        selectedActions.push(action);
      }
    }

    // Generate a challenge ID
    const challengeId = crypto.randomBytes(16).toString("hex");

    // In a real implementation, you would store this challenge in the database
    // To verify later that the user completed the correct actions

    res.json({
      success: true,
      data: {
        challengeId,
        actions: selectedActions,
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
    const kyc = await KYC.findOne({ userId: req.user.id })
      .select(
        "-biometricData.faceData.imageUrl -biometricData.videoData.videoUrl -documents.frontImageUrl -documents.backImageUrl"
      )
      .sort({ createdAt: -1 });

    if (!kyc) {
      return res.status(404).json({
        success: false,
        message: "No KYC application found",
        data: {
          currentStep: 1,
          completedSteps: {
            faceVerification: { completed: false },
            documentVerification: { completed: false },
            videoVerification: { completed: false },
          },
        },
      });
    }

    res.json({
      success: true,
      data: {
        status: kyc.status,
        currentStep: kyc.currentStep,
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

    // Update current step based on completed steps
    kyc.updateCurrentStep();

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

    res.json({
      success: true,
      data: {
        currentStep: kyc.currentStep,
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

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

const UPLOAD_DIR =
  process.env.ID_UPLOAD_DIR || path.join(process.cwd(), "public", "uploads");
const FPT_API_KEY =
  process.env.FPT_AI_API_KEY || "kXmIitbsxqFi8t60QmdQaUue9y1Qk9JW";
const ISSUING_COUNTRY_DEFAULT = process.env.ID_ISSUING_COUNTRY || "Vietnam";

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
// export const uploadIDDocument = async (req, res) => {
//   try {
//     const { frontImage, backImage } = req.files;
//     const userId = req.user.id;

//     // Validate file types
//     const allowedTypes = ["image/png", "image/jpeg", "image/jpg"];
//     if (!allowedTypes.includes(frontImage[0].mimetype) ||
//         !allowedTypes.includes(backImage[0].mimetype)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid file format. Only PNG and JPG are allowed."
//       });
//     }

//     // Process with FPT.AI or similar service
//     const formData = new FormData();
//     formData.append("image", fs.createReadStream(frontImage[0].path));
//     formData.append("type", "identity_card");

//     const apiResponse = await axios.post(
//       process.env.ID_VERIFICATION_API_URL,
//       formData,
//       {
//         headers: {
//           "api-key": process.env.ID_VERIFICATION_API_KEY,
//           ...formData.getHeaders(),
//         },
//       }
//     );

//     // Check for duplicate ID
//     const extractedID = apiResponse.data.data[0].id;
//     const existingKYC = await KYC.findOne({
//       "documents.documentNumber": extractedID
//     });

//     if (existingKYC) {
//       return res.status(400).json({
//         success: false,
//         message: "This ID number has already been registered"
//       });
//     }

//     // Update KYC document
//     const kyc = await KYC.findOne({ userId });
//     kyc.documents.push({
//       type: "nationalId",
//       documentNumber: extractedID,
//       frontImageUrl: frontImage[0].path,
//       backImageUrl: backImage[0].path,
//       ocrData: {
//         extractedFields: apiResponse.data.data[0],
//         confidence: apiResponse.data.confidence,
//         processedAt: new Date()
//       }
//     });

//     await kyc.save();

//     return res.status(200).json({
//       success: true,
//       message: "ID document processed successfully",
//       data: kyc.documents[kyc.documents.length - 1]
//     });
//   } catch (error) {
//     console.error("Error processing ID document:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Failed to process ID document"
//     });
//   }
// };
export const uploadIDDocument = async (req, res) => {
  try {
    const { frontImage, backImage } = req.files;
    const userId = req.user.id;

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

    const frontFileName = `${userId}-id-front-${Date.now()}.${
      frontImage[0].mimetype.split("/")[1]
    }`;
    const backFileName = `${userId}-id-back-${Date.now()}.${
      backImage[0].mimetype.split("/")[1]
    }`;
    const frontFilePath = path.join(UPLOAD_DIR, frontFileName);
    const backFilePath = path.join(UPLOAD_DIR, backFileName);

    const frontBuffer = await fsp.readFile(frontImage[0].path);
    const backBuffer = await fsp.readFile(backImage[0].path);

    await fsp.writeFile(frontFilePath, frontBuffer);
    await fsp.writeFile(backFilePath, backBuffer);

    const formData = new FormData();
    formData.append("image", fs.createReadStream(frontFilePath));

    const fptResponse = await axios.post(
      "https://api.fpt.ai/vision/idr/vnm",
      formData,
      {
        headers: {
          "api-key": FPT_API_KEY,
          ...formData.getHeaders(),
        },
      }
    );

    const fptData = fptResponse.data;

    if (fptResponse.status === 200 && fptData.data && fptData.data.length > 0) {
      const extractedID = fptData.data[0].id;
      const extractedName = fptData.data[0].name;
      const extractedDOB = fptData.data[0].dob;

      const existingKYC = await KYC.findOne({
        "documents.documentNumber": extractedID,
      });

      if (existingKYC) {
        await safeUnlink(frontFilePath);
        await safeUnlink(backFilePath);
        return res.status(400).json({
          success: false,
          message: "This ID number has already been registered",
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

      kyc.documents.push({
        type: "nationalId",
        documentNumber: extractedID,
        issuingCountry: ISSUING_COUNTRY_DEFAULT,
        frontImageUrl: `/uploads/${frontFileName}`,
        backImageUrl: `/uploads/${backFileName}`,
        verificationStatus: "pending",
        ocrData: {
          extractedFields: fptData.data[0],
          confidence: fptData.confidence || 1,
          processedAt: new Date(),
        },
      });

      kyc.completedSteps.documentVerification = {
        completed: true,
        completedAt: new Date(),
        attempts: (kyc.completedSteps.documentVerification?.attempts || 0) + 1,
      };

      await kyc.save();

      return res.status(200).json({
        success: true,
        message: "ID document processed successfully",
        data: kyc.documents[kyc.documents.length - 1],
      });
    } else {
      await safeUnlink(frontFilePath);
      await safeUnlink(backFilePath);
      return res.status(400).json({
        success: false,
        message: "ID document verification failed",
      });
    }
  } catch (error) {
    console.error("Error processing ID document:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to process ID document",
      error: error.message,
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
    let kyc = await KYC.findOne({ userId });
    if (!kyc) {
      await deleteFile(videoFile.path);
      return res.status(404).json({
        success: false,
        message: "KYC application not found",
      });
    }

    // Get the ID card image from the most recent document
    const latestDocument = kyc.documents[kyc.documents.length - 1];
    if (!latestDocument || !latestDocument.frontImageUrl) {
      await deleteFile(videoFile.path);
      return res.status(400).json({
        success: false,
        message:
          "ID card image not found. Please complete document verification first.",
      });
    }

    // Get absolute path for ID card image
    const idCardPath = path.join(
      process.cwd(),
      "public",
      latestDocument.frontImageUrl
    );

    // Verify ID card image exists
    try {
      await fsp.access(idCardPath);
    } catch (error) {
      await deleteFile(videoFile.path);
      return res.status(400).json({
        success: false,
        message: "ID card image file not found",
      });
    }

    // Handle video conversion
    let videoPath = videoFile.path;
    if (videoFile.mimetype === "video/webm") {
      try {
        // Check if ffmpeg is available
        if (!ffmpegStatic) {
          throw new Error("ffmpeg not found");
        }

        const mp4Path = videoFile.path.replace(".webm", ".mp4");
        await new Promise((resolve, reject) => {
          ffmpeg(videoFile.path)
            .setFfmpegPath(ffmpegStatic)
            .output(mp4Path)
            .on("end", () => {
              resolve();
            })
            .on("error", (err) => {
              reject(err);
            })
            .run();
        });
        videoPath = mp4Path;
      } catch (error) {
        console.error("Error converting video:", error);
        // If conversion fails, try to use the original file
        if (error.message.includes("ffmpeg not found")) {
          console.warn("FFmpeg not found, using original video file");
          // Continue with original file
        } else {
          await deleteFile(videoFile.path);
          return res.status(500).json({
            success: false,
            message: "Error converting video format",
          });
        }
      }
    }

    // Prepare files for FPT AI liveness detection
    const formData = new FormData();

    // Add video file
    formData.append("video", fs.createReadStream(videoPath), {
      filename: "video.mp4",
      contentType:
        videoFile.mimetype === "video/webm" ? "video/webm" : "video/mp4",
    });

    // Add ID card image
    formData.append("cmnd", fs.createReadStream(idCardPath), {
      filename: "id_card.jpg",
      contentType: "image/jpeg",
    });

    // Call FPT AI liveness detection API
    const fptResponse = await axios.post(
      "https://api.fpt.ai/dmp/liveness/v3",
      formData,
      {
        headers: {
          api_key: FPT_API_KEY,
          ...formData.getHeaders(),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );

    // Process FPT AI response
    if (fptResponse.status === 200 && fptResponse.data) {
      const livenessResult = fptResponse.data;

      // Generate secure filename for video
      const secureFilename = `${crypto.randomBytes(16).toString("hex")}.mp4`;

      // Create secure storage path
      const storageDir = path.join(
        process.cwd(),
        "storage",
        "biometric",
        "video"
      );
      await fs.promises.mkdir(storageDir, { recursive: true });

      // Move file to secure location
      const securePath = path.join(storageDir, secureFilename);
      await fs.promises.rename(videoPath, securePath);

      // Clean up original file if it was converted
      if (videoPath !== videoFile.path) {
        await deleteFile(videoFile.path);
      }

      // Update video data with liveness results
      kyc.biometricData.videoData = {
        videoUrl: securePath,
        verificationStatus: "verified", // Always mark as verified for now
        confidence: 1,
        livenessScore: 1,
        faceMatchScore: 1,
        uploadedAt: new Date(),
        fileType:
          videoFile.mimetype === "video/webm" ? "video/webm" : "video/mp4",
        fileSize: (await fsp.stat(securePath)).size,
        // Commenting out FPT response for now
        // fptResponse: livenessResult,
      };

      // Mark video verification step as completed immediately
      kyc.completedSteps.videoVerification = {
        completed: true,
        completedAt: new Date(),
        attempts: (kyc.completedSteps.videoVerification?.attempts || 0) + 1,
      };

      // If all steps are completed, change status to pending review
      if (
        kyc.completedSteps.faceVerification?.completed &&
        kyc.completedSteps.documentVerification?.completed &&
        kyc.completedSteps.videoVerification?.completed
      ) {
        // Status will be automatically updated to "approved" by the pre-save middleware
        kyc.status = "pending";
        
        // Update user's verification status
        await User.findByIdAndUpdate(userId, {
          isVerified: true,
          verificationStatus: "approved"
        });
      }

      await kyc.save();

      res.json({
        success: true,
        data: {
          status: kyc.status,
          // Commenting out scores for now
          // livenessScore: livenessResult.liveness_score,
          // faceMatchScore: livenessResult.face_match_score,
          currentStep: kyc.currentStep,
          completedSteps: kyc.completedSteps,
        },
      });
    } else {
      // Clean up files
      await deleteFile(videoPath);
      if (videoPath !== videoFile.path) {
        await deleteFile(videoFile.path);
      }
      return res.status(400).json({
        success: false,
        message: "Liveness detection failed",
      });
    }
  } catch (error) {
    console.error("Video upload error:", error);
    if (req.file?.path) {
      await deleteFile(req.file.path);
    }
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
        },
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year expiry
      });
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

    // Update user's verification status based on KYC status
    await User.findByIdAndUpdate(kyc.userId, {
      isVerified: status === "approved",
      verificationStatus: status
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
    res.cookie("kycCompletedSteps", JSON.stringify(kyc.completedSteps), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "development",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
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
    await fs.promises.mkdir(storageDir, { recursive: true });

    // Move file to secure location
    const securePath = path.join(storageDir, secureFilename);
    await fs.promises.rename(voiceFile.path, securePath);

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

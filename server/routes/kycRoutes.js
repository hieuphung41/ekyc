import express from "express";
import {
  uploadFacePhoto,
  uploadIDDocument,
  getLivenessChallenge,
  getKYCStatus,
  verifyKYC,
  resetKycStep,
  getAllKYC,
  uploadVoiceSample,
  verifyVoiceSample,
  uploadVideo,
  processSpeechRecognition,
  getUserKycStatus
} from "../controllers/kycController.js";
import { protect, authorize } from "../middlewares/auth.js";
import { uploadMiddleware } from "../utils/fileUpload.js";

const router = express.Router();

// Document verification routes
router.post(
  "/document",
  protect,
  uploadMiddleware.fields([
    { name: "front", maxCount: 1 },
    { name: "back", maxCount: 1 },
  ]),
  uploadIDDocument
);

// Biometric verification routes
router.post(
  "/face",
  protect,
  (req, res, next) => {
    uploadMiddleware(req, res, (err) => {
      if (err) {
        console.error('Multer error:', err);
        return res.status(400).json({
          success: false,
          message: err.message
        });
      }
      console.log('Multer processed file:', {
        file: req.file ? {
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
          hasBuffer: req.file.buffer ? true : false,
          bufferSize: req.file.buffer?.length
        } : 'No file'
      });
      next();
    });
  },
  uploadFacePhoto
);

// Video verification routes
router.post(
  "/video",
  protect,
  uploadMiddleware.single("videoFile"),
  uploadVideo
);

// Voice verification routes
router.post(
  "/voice",
  protect,
  uploadMiddleware.single("voiceSample"),
  uploadVoiceSample
);

router.post(
  "/voice/verify/:kycId",
  protect,
  uploadMiddleware.single("voiceSample"),
  verifyVoiceSample
);

// Liveness check routes
router.get("/liveness-challenge", protect, getLivenessChallenge);

// KYC status and management routes
router.get("/status", protect, getKYCStatus);

router.get("/users/status", protect, getUserKycStatus)

router.put("/verify/:id", protect, authorize("admin"), verifyKYC);

router.post("/reset-step/:step", protect, resetKycStep);

// Admin only routes
router.get("/all", protect, authorize("admin"), getAllKYC);

// Speech recognition route
router.post(
  "/speech",
  protect,
  uploadMiddleware.single("audioFile"),
  processSpeechRecognition
);

export default router;

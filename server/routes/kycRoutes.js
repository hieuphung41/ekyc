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
  uploadMiddleware.single("file"),
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

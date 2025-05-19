import express from "express";
import {
  uploadDocument,
  uploadBiometric,
  processOCR,
  getLivenessChallenge,
  getKYCStatus,
  verifyKYC,
  resetKycStep,
  getAllKYC,
  uploadVoiceSample,
  verifyVoiceSample,
} from "../controllers/kycController.js";
import { protect, authorize } from "../middlewares/auth.js";
import { uploadMiddleware } from "../utils/fileUpload.js";

const router = express.Router();

// Document verification routes
router.post(
  "/document",
  protect,
  uploadMiddleware.fields([
    { name: "frontImage", maxCount: 1 },
    { name: "backImage", maxCount: 1 },
  ]),
  uploadDocument
);

// OCR processing route
router.post("/ocr", protect, processOCR);

// Biometric verification routes
router.post(
  "/biometric",
  protect,
  uploadMiddleware.single("file"),
  uploadBiometric
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

router.put("/verify/:id", protect, authorize("admin"), verifyKYC);

router.post("/reset-step", protect, resetKycStep);

// Admin only routes
router.get("/all", protect, authorize("admin"), getAllKYC);

export default router;

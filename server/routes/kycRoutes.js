import express from "express";
import {
  submitKYC,
  uploadBiometric,
  getKYCStatus,
  verifyKYC,
  getAllKYC,
  processOCR,
  getLivenessChallenge,
  resetKycStep,
} from "../controllers/kycController.js";
import { protect, authorize } from "../middlewares/auth.js";
import { uploadMiddleware } from "../utils/fileUpload.js";

const router = express.Router();

// Protected routes
router.post(
  "/submit",
  protect,
  uploadMiddleware.fields([{ name: "faceVideo", maxCount: 1 }]),
  (req, res, next) => {
    // Check if files are available
    if (
      !req.files ||
      !req.files.faceVideo ||
      req.files.faceVideo.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Video file is required. Make sure you've recorded a verification video.",
      });
    }

    // Forward to the main controller
    submitKYC(req, res, next);
  }
);

router.post(
  "/biometric",
  protect,
  uploadMiddleware.single("file"),
  uploadBiometric
);
router.post("/ocr", protect, processOCR);
router.post("/reset-step", protect, resetKycStep);
router.get("/liveness-challenge", protect, getLivenessChallenge);
router.get("/status", protect, getKYCStatus);

// Admin routes
router.get("/all", protect, authorize("admin"), getAllKYC);
router.put("/verify/:id", protect, authorize("admin"), verifyKYC);

export default router;

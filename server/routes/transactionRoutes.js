import express from "express";
import {
  createTransaction,
  verifyTransactionFace,
  verifyTransactionVoice,
  getTransactionStatus,
  getUserTransactions,
  getTransactionHistory,
  deleteTransaction,
} from "../controllers/transactionController.js";
import { protect } from "../middlewares/auth.js";
import { uploadMiddleware } from "../utils/fileUpload.js";

const router = express.Router();

// All routes are protected
router.use(protect);

// Create new transaction
router.post("/", createTransaction);

// Get all transactions for user
router.get("/", getUserTransactions);

// Get transaction status
router.get("/:id", getTransactionStatus);

// Get transaction verification history
router.get("/:id/history", getTransactionHistory);

// Verify transaction with face
router.post(
  "/:id/verify/face",
  uploadMiddleware.single("faceImage"),
  verifyTransactionFace
);

// Verify transaction with voice
router.post(
  "/:id/verify/voice",
  uploadMiddleware.single("voiceSample"),
  verifyTransactionVoice
);

// Delete transaction
router.delete("/:id", deleteTransaction);

export default router; 
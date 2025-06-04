import Transaction from "../models/Transaction.js";
import User from "../models/User.js";
import { uploadMiddleware, deleteFile } from "../utils/fileUpload.js";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import fsp from "fs/promises";
import axios from "axios";
import FormData from "form-data";
import sdk from "microsoft-cognitiveservices-speech-sdk";
import dotenv from "dotenv";

dotenv.config();

const FPT_API_KEY = process.env.FPT_AI_API_KEY;
const AZURE_SPEECH_KEY = process.env.AZURE_KEY;
const AZURE_SPEECH_REGION = "eastus";

// @desc    Create a new transaction
// @route   POST /api/transactions
// @access  Private
export const createTransaction = async (req, res) => {
  try {
    const { type, amount, currency, verificationMethod } = req.body;
    const userId = req.user.id;

    // Generate unique transaction ID
    const transactionId = crypto.randomBytes(16).toString("hex");

    // Create transaction with 15-minute expiry
    const transaction = await Transaction.create({
      userId,
      transactionId,
      type,
      amount,
      currency,
      verificationMethod,
      metadata: {
        ipAddress: req.ip,
        deviceInfo: req.headers["user-agent"],
      },
      expiryTime: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
    });

    res.status(201).json({
      success: true,
      data: transaction,
    });
  } catch (error) {
    console.error("Create transaction error:", error);
    res.status(500).json({
      success: false,
      message: "Error creating transaction",
    });
  }
};

// @desc    Verify transaction with face
// @route   POST /api/transactions/:id/verify/face
// @access  Private
export const verifyTransactionFace = async (req, res) => {
  try {
    const { id } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "No face image uploaded",
      });
    }

    const transaction = await Transaction.findOne({
      transactionId: id,
      userId: req.user.id,
    });

    if (!transaction) {
      await deleteFile(file.path);
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }

    // Get user's KYC photo
    const user = await User.findById(req.user.id);
    if (!user || !user.biometricData?.faceData?.imageUrl) {
      await deleteFile(file.path);
      return res.status(400).json({
        success: false,
        message: "User KYC data not found",
      });
    }

    // Create form data for FPT AI API
    const formData = new FormData();
    formData.append("file[]", fs.createReadStream(file.path));
    formData.append(
      "file[]",
      fs.createReadStream(user.biometricData?.faceData?.imageUrl)
    );

    // Call FPT AI face matching API
    const fptResponse = await axios.post(
      "https://api.fpt.ai/dmp/checkface/v1",
      formData,
      {
        headers: {
          api_key: FPT_API_KEY,
          ...formData.getHeaders(),
        },
      }
    );

    if (fptResponse.status === 200 && fptResponse.data) {
      const verificationResult = fptResponse.data;
      const isMatch = verificationResult.data?.similarity >= 0.8; // 80% similarity threshold

      // Generate secure filename
      const secureFilename = `${crypto.randomBytes(16).toString("hex")}.jpg`;

      // Create secure storage path
      const storageDir = path.join(
        process.cwd(),
        "storage",
        "transactions",
        "face"
      );
      await fs.promises.mkdir(storageDir, { recursive: true });

      // Move file to secure location
      const securePath = path.join(storageDir, secureFilename);
      await fs.promises.rename(file.path, securePath);

      // Update transaction with verification data
      await transaction.verify("face", {
        faceConfidence: verificationResult.data?.similarity || 0,
        faceImageUrl: securePath,
        confidence: verificationResult.data?.similarity || 0,
      });

      if (!isMatch) {
        return res.status(400).json({
          success: false,
          message: "Face verification failed - faces do not match",
          data: {
            similarity: verificationResult.data?.similarity,
          },
        });
      }

      res.json({
        success: true,
        data: {
          transactionId: transaction.transactionId,
          type: transaction.type,
          amount: transaction.amount,
          currency: transaction.currency,
          status: transaction.status,
          riskScore: transaction.riskScore,
          verificationData: transaction.verificationData,
          similarity: verificationResult.data?.similarity,
        },
      });
    } else {
      await deleteFile(file.path);
      return res.status(400).json({
        success: false,
        message: "Face verification failed",
      });
    }
  } catch (error) {
    console.error("Face verification error:", error);
    if (req.file?.path) {
      await deleteFile(req.file.path);
    }
    res.status(500).json({
      success: false,
      message: "Error verifying transaction with face",
    });
  }
};

// @desc    Verify transaction with voice
// @route   POST /api/transactions/:id/verify/voice
// @access  Private
export const verifyTransactionVoice = async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;
    const audioFile = req.file;

    if (!audioFile || !text) {
      if (audioFile) await deleteFile(audioFile.path);
      return res.status(400).json({
        success: false,
        message: "Missing audio file or text",
      });
    }

    const transaction = await Transaction.findOne({
      transactionId: id,
      userId: req.user.id,
    });

    if (!transaction) {
      await deleteFile(audioFile.path);
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }

    if (transaction.isExpired()) {
      await deleteFile(audioFile.path);
      return res.status(400).json({
        success: false,
        message: "Transaction has expired",
      });
    }

    // Configure Azure Speech Service
    const speechConfig = sdk.SpeechConfig.fromSubscription(
      AZURE_SPEECH_KEY,
      AZURE_SPEECH_REGION
    );
    speechConfig.speechRecognitionLanguage = "en-US";

    // Read the audio file
    const audioBuffer = await fs.promises.readFile(audioFile.path);
    const audioConfig = sdk.AudioConfig.fromWavFileInput(audioBuffer);

    // Create speech recognizer
    const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

    // Process speech recognition
    const result = await new Promise((resolve, reject) => {
      recognizer.recognizeOnceAsync(
        (result) => {
          resolve(result);
        },
        (error) => {
          reject(error);
        }
      );
    });

    // Get recognized text
    const recognizedText = result.text.trim().toLowerCase();
    const expectedTextLower = text.trim().toLowerCase();

    // Calculate similarity score
    const isMatch = recognizedText === expectedTextLower;
    const confidence = result.confidence || 0;

    // Generate secure filename
    const secureFilename = `${crypto.randomBytes(16).toString("hex")}.wav`;

    // Create secure storage path
    const storageDir = path.join(
      process.cwd(),
      "storage",
      "transactions",
      "voice"
    );
    await fs.promises.mkdir(storageDir, { recursive: true });

    // Move file to secure location
    const securePath = path.join(storageDir, secureFilename);
    await fs.promises.rename(audioFile.path, securePath);

    // Update transaction with verification data
    await transaction.verify("voice", {
      voiceConfidence: confidence,
      voiceAudioUrl: securePath,
      confidence: confidence,
    });

    res.json({
      success: true,
      data: {
        status: transaction.status,
        riskScore: transaction.riskScore,
        verificationData: transaction.verificationData,
        isMatch,
        confidence,
      },
    });
  } catch (error) {
    console.error("Voice verification error:", error);
    if (req.file?.path) {
      await deleteFile(req.file.path);
    }
    res.status(500).json({
      success: false,
      message: "Error verifying transaction with voice",
    });
  }
};

// @desc    Get transaction status
// @route   GET /api/transactions/:id
// @access  Private
export const getTransactionStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const transaction = await Transaction.findOne({
      transactionId: id,
      userId: req.user.id,
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }

    // Check if transaction is expired
    if (transaction.isExpired() && transaction.status === "pending") {
      try {
        transaction.status = "expired";
        await transaction.save();
      } catch (error) {
        console.error("Error updating transaction status:", error);
        // Continue with the current status if update fails
      }
    }

    res.json({
      success: true,
      data: {
        transactionId: transaction.transactionId,
        type: transaction.type,
        amount: transaction.amount,
        currency: transaction.currency,
        status: transaction.status,
        riskScore: transaction.riskScore,
        verificationData: transaction.verificationData,
        verificationMethod: transaction.verificationMethod,
        expiryTime: transaction.expiryTime,
        createdAt: transaction.createdAt,
        updatedAt: transaction.updatedAt,
        metadata: transaction.metadata,
      },
    });
  } catch (error) {
    console.error("Get transaction status error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching transaction status",
    });
  }
};

// @desc    Get all transactions for user
// @route   GET /api/transactions
// @access  Private
export const getUserTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .select(
        "-verificationData.faceVerification.imageUrl -verificationData.voiceVerification.audioUrl"
      );

    res.json({
      success: true,
      data: transactions,
    });
  } catch (error) {
    console.error("Get user transactions error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching transactions",
    });
  }
};

// @desc    Get transaction verification history
// @route   GET /api/transactions/:id/history
// @access  Private
export const getTransactionHistory = async (req, res) => {
  try {
    const { id } = req.params;

    const transaction = await Transaction.findOne({
      transactionId: id,
      userId: req.user.id,
    }).select("verificationHistory");

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }

    res.json({
      success: true,
      data: transaction.verificationHistory,
    });
  } catch (error) {
    console.error("Get transaction history error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching transaction history",
    });
  }
};

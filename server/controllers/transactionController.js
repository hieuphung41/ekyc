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
import KYC from "../models/KYC.js";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import { uploadToBlobStorage, deleteFromBlobStorage, CONTAINERS } from "../utils/azureStorage.js";

dotenv.config();

const FPT_API_KEY = process.env.FPT_AI_API_KEY;
const AZURE_SPEECH_KEY = process.env.AZURE_KEY;
const AZURE_SPEECH_REGION = "eastus";

// Helper function to check if transaction is expired
const isTransactionExpired = (transaction) => {
  const expiryTime = new Date(transaction.createdAt);
  expiryTime.setMinutes(expiryTime.getMinutes() + 15); // 15 minutes expiry
  return new Date() > expiryTime;
};

// Helper function to update transaction status
const updateTransactionStatus = async (transaction) => {
  if (isTransactionExpired(transaction)) {
    transaction.status = "expired";
    await transaction.save();
    return false;
  }

  // If verification is completed successfully
  if (transaction.verificationMethod === "face" && 
      transaction.verificationData?.face?.verified) {
    transaction.status = "approved";
    await transaction.save();
    return true;
  } else if (transaction.verificationMethod === "voice" && 
             transaction.verificationData?.voice?.verified) {
    transaction.status = "approved";
    await transaction.save();
    return true;
  }

  return false;
};

// Helper function to normalize text for comparison
const normalizeText = (text) => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[.,!?]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ');  // Normalize spaces
};

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

    // Check if transaction is expired
    if (isTransactionExpired(transaction)) {
      transaction.status = "expired";
      await transaction.save();
      await deleteFile(file.path);
      return res.status(400).json({
        success: false,
        message: "Transaction has expired",
      });
    }

    // Get user's KYC data
    const kyc = await KYC.findOne({ userId: req.user.id });
    if (!kyc || !kyc.biometricData?.faceData?.imageUrl) {
      await deleteFile(file.path);
      return res.status(400).json({
        success: false,
        message: "User KYC data not found",
      });
    }

    try {
      // Generate a unique blob name
      const blobName = `${transaction.transactionId}-${Date.now()}.jpg`;
      
      // Upload the file to Azure Blob Storage
      const blobUrl = await uploadToBlobStorage(
        file.buffer,
        CONTAINERS.FACE,
        blobName,
        file.mimetype
      );

      // Create form data for FPT AI face matching API
      const formData = new FormData();
      
      // Get the KYC face image from Azure Blob Storage
      const kycBlobName = path.basename(kyc.biometricData.faceData.imageUrl);
      const kycBlobUrl = await generateSasToken(CONTAINERS.FACE, kycBlobName);
      
      // Add files to form data
      formData.append("file[]", file.buffer, {
        filename: blobName,
        contentType: file.mimetype,
      });
      formData.append("file[]", kycBlobUrl, kycBlobName);

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

      // Handle different FPT AI response codes
      if (fptResponse.data.code === "407") {
        await deleteFromBlobStorage(CONTAINERS.FACE, blobName);
        return res.status(400).json({
          success: false,
          message: "No faces detected in one or both images",
        });
      }

      if (fptResponse.data.code === "408") {
        await deleteFromBlobStorage(CONTAINERS.FACE, blobName);
        return res.status(400).json({
          success: false,
          message: "Invalid image format. Only JPG and JPEG are allowed",
        });
      }

      if (fptResponse.data.code === "409") {
        await deleteFromBlobStorage(CONTAINERS.FACE, blobName);
        return res.status(400).json({
          success: false,
          message: "Please upload exactly 2 images for face check",
        });
      }

      if (fptResponse.data.code === "200" && fptResponse.data.data) {
        const verificationResult = fptResponse.data.data;
        const isMatch = verificationResult.similarity >= 0.8; // 80% similarity threshold

        // Update transaction with verification data
        await transaction.verify("face", {
          faceConfidence: verificationResult.similarity || 0,
          faceImageUrl: blobUrl,
          confidence: verificationResult.similarity || 0,
          verified: isMatch
        });

        if (!isMatch) {
          await deleteFromBlobStorage(CONTAINERS.FACE, blobName);
          return res.status(400).json({
            success: false,
            message: "Face verification failed - faces do not match",
            data: {
              similarity: verificationResult.similarity,
              isBothImgIDCard: verificationResult.isBothImgIDCard
            },
          });
        }

        // Update transaction status
        const isVerified = await updateTransactionStatus(transaction);

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
            similarity: verificationResult.similarity,
            isBothImgIDCard: verificationResult.isBothImgIDCard,
            isVerified,
          },
        });
      } else {
        await deleteFromBlobStorage(CONTAINERS.FACE, blobName);
        return res.status(400).json({
          success: false,
          message: "Face verification failed - unexpected response from FPT AI",
          data: fptResponse.data
        });
      }
    } catch (error) {
      console.error("Face verification error:", error);
      res.status(500).json({
        success: false,
        message: "Error verifying transaction with face",
      });
    }
  } catch (error) {
    console.error("Face verification error:", error);
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
    const file = req.file;
    const { text } = req.body;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "No voice sample uploaded",
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

    // Check if transaction is expired
    if (isTransactionExpired(transaction)) {
      transaction.status = "expired";
      await transaction.save();
      await deleteFile(file.path);
      return res.status(400).json({
        success: false,
        message: "Transaction has expired",
      });
    }

    // Get user's KYC data
    const kyc = await KYC.findOne({ userId: req.user.id });
    if (!kyc || !kyc.biometricData?.voiceData?.audioUrl) {
      await deleteFile(file.path);
      return res.status(400).json({
        success: false,
        message: "User KYC data not found",
      });
    }

    // Create a unique output path for the WAV file
    const outputDir = path.join(process.cwd(), "uploads", "temp");
    await fs.promises.mkdir(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, `converted-${Date.now()}.wav`);

    // Convert audio to WAV format with specific parameters
    try {
      await new Promise((resolve, reject) => {
        ffmpeg(file.path)
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
          ])
          .on("end", () => {
            resolve();
          })
          .on("error", (err) => {
            reject(err);
          })
          .save(outputPath);
      });

      // Verify the WAV file exists and has content
      const stats = await fs.promises.stat(outputPath);
      if (stats.size === 0) {
        throw new Error("Generated WAV file is empty");
      }
    } catch (error) {
      console.error("Error converting audio:", error);
      await deleteFile(file.path);
      if (fs.existsSync(outputPath)) {
        await deleteFile(outputPath);
      }
      return res.status(500).json({
        success: false,
        message: "Error converting audio format",
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

    // Create audio config from buffer
    const audioConfig = sdk.AudioConfig.fromWavFileInput(wavBuffer);

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

    // Get recognized text and normalize both texts for comparison
    const recognizedText = result.text.trim();
    const normalizedRecognizedText = normalizeText(recognizedText);
    const normalizedExpectedText = normalizeText(text);

    // Calculate similarity score (simple exact match for now)
    const isMatch = normalizedRecognizedText === normalizedExpectedText;
    const confidence = result.confidence || 0;

    // Generate a unique blob name
    const blobName = `${transaction.transactionId}-${Date.now()}.wav`;
    
    // Upload the file to Azure Blob Storage
    const blobUrl = await uploadToBlobStorage(
      wavBuffer,
      CONTAINERS.VOICE,
      blobName,
      "audio/wav"
    );

    // Update transaction with verification data
    await transaction.verify("voice", {
      voiceSampleUrl: blobUrl,
      recognizedText: recognizedText,
      expectedText: text,
      confidence: confidence,
      verified: isMatch
    });

    if (!isMatch) {
      await deleteFromBlobStorage(CONTAINERS.VOICE, blobName);
      return res.status(400).json({
        success: false,
        message: "Voice verification failed - text does not match",
        data: {
          recognizedText,
          expectedText: text,
          confidence,
          normalizedRecognizedText,
          normalizedExpectedText
        },
      });
    }

    // Update transaction status
    const isVerified = await updateTransactionStatus(transaction);

    // Clean up the temporary files
    try {
      await deleteFile(file.path);
      if (fs.existsSync(outputPath)) {
        await deleteFile(outputPath);
      }
    } catch (error) {
      console.error("Error cleaning up temporary files:", error);
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
        confidence: confidence,
        isVerified,
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

// @desc    Delete transaction
// @route   DELETE /api/transactions/:id
// @access  Private
export const deleteTransaction = async (req, res) => {
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

    // Delete associated files if they exist
    if (transaction.verificationData?.face?.faceImageUrl) {
      await deleteFile(transaction.verificationData.face.faceImageUrl);
    }
    if (transaction.verificationData?.voice?.voiceSampleUrl) {
      await deleteFile(transaction.verificationData.voice.voiceSampleUrl);
    }

    // Delete the transaction
    await transaction.deleteOne();

    res.json({
      success: true,
      data: {
        transactionId: transaction.transactionId,
        message: "Transaction deleted successfully",
      },
    });
  } catch (error) {
    console.error("Delete transaction error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting transaction",
    });
  }
};

import Verification from '../models/Verification.js';
import axios from 'axios';
import { deleteFile } from '../utils/fileUpload.js';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import fsp from 'fs/promises';
import FormData from 'form-data';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import sdk from 'microsoft-cognitiveservices-speech-sdk';
import dotenv from 'dotenv';

dotenv.config();

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
const FPT_API_KEY = process.env.FPT_AI_API_KEY;
const AZURE_SPEECH_KEY = process.env.AZURE_KEY;
const AZURE_SPEECH_REGION = process.env.AZURE_SPEECH_REGION || 'eastus';

// Service communication helper
const userService = axios.create({
  baseURL: process.env.USER_SERVICE_URL,
  timeout: 5000
});

// Helper function to safely delete files
async function safeUnlink(filePath) {
  try {
    await fsp.unlink(filePath);
  } catch (err) {
    console.warn(`Failed to delete file ${filePath}:`, err.message);
  }
}

// Helper function to update user verification status
async function updateUserVerificationStatus(userId, status, token) {
  try {
    await userService.patch(
      `/api/users/${userId}/verification-status`,
      {
        isVerified: status === 'approved',
        verificationStatus: status
      },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
  } catch (error) {
    console.error('Error updating user verification status:', error);
    throw new Error('Failed to update user verification status');
  }
}

// Get verification status
export const getVerificationStatus = async (req, res) => {
  try {
    let verification = await Verification.findOne({ 
      userId: req.user.id,
      verificationType: 'kyc'
    }).select('-verificationData.faceData.imageUrl -verificationData.videoData.videoUrl -verificationData.documentData.frontImageUrl -verificationData.documentData.backImageUrl');

    if (!verification) {
      // Create new verification record if none exists
      verification = await Verification.create({
        userId: req.user.id,
        verificationType: 'kyc',
        status: 'pending',
        completedSteps: {
          faceVerification: { completed: false },
          documentVerification: { completed: false },
          videoVerification: { completed: false },
          voiceVerification: { completed: false }
        },
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year expiry
      });
    }

    res.json({
      success: true,
      data: {
        status: verification.status,
        completedSteps: verification.completedSteps,
        verificationData: verification.verificationData,
        expiryDate: verification.expiryDate,
        verificationHistory: verification.verificationHistory,
        createdAt: verification.createdAt,
        updatedAt: verification.updatedAt
      }
    });
  } catch (error) {
    console.error('Verification status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching verification status'
    });
  }
};

// Upload face photo
export const uploadFacePhoto = async (req, res) => {
  try {
    const { faceMetadata } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'No face photo uploaded'
      });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png'];
    if (!allowedTypes.includes(file.mimetype)) {
      await deleteFile(file.path);
      return res.status(400).json({
        success: false,
        message: 'Invalid file type. Only JPEG and PNG are allowed'
      });
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      await deleteFile(file.path);
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size: 5MB'
      });
    }

    // Find existing verification
    let verification = await Verification.findOne({ 
      userId: req.user.id,
      verificationType: 'kyc'
    });

    if (!verification) {
      await deleteFile(file.path);
      return res.status(404).json({
        success: false,
        message: 'Verification record not found'
      });
    }

    // Generate secure filename
    const fileExtension = path.extname(file.originalname);
    const secureFilename = `${crypto.randomBytes(16).toString('hex')}${fileExtension}`;

    // Create secure storage path
    const storageDir = path.join(process.cwd(), 'storage', 'biometric', 'face');
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
        console.error('Error parsing face metadata:', e);
      }
    }

    // Update face data
    verification.verificationData.faceData = {
      imageUrl: securePath,
      verificationStatus: 'pending',
      confidence: confidence,
      livenessScore: livenessScore,
      uploadedAt: new Date(),
      fileType: file.mimetype,
      fileSize: file.size
    };

    // Mark face verification step as completed if liveness passed
    if (livenessScore > 0.5) {
      verification.completedSteps.faceVerification = {
        completed: true,
        completedAt: new Date(),
        attempts: (verification.completedSteps.faceVerification?.attempts || 0) + 1
      };
    }

    await verification.save();

    // Update user's verification status
    await updateUserVerificationStatus(
      req.user.id,
      verification.status,
      req.headers.authorization.split(' ')[1]
    );

    res.json({
      success: true,
      data: {
        status: verification.status,
        livenessScore: verification.verificationData.faceData.livenessScore,
        currentStep: verification.getNextIncompleteStep(),
        completedSteps: verification.completedSteps
      }
    });
  } catch (error) {
    console.error('Face photo upload error:', error);
    if (req.file?.path) {
      await deleteFile(req.file.path);
    }
    res.status(500).json({
      success: false,
      message: 'Error uploading face photo'
    });
  }
};

// Upload ID document
export const uploadIDDocument = async (req, res) => {
  try {
    if (!FPT_API_KEY) {
      return res.status(500).json({
        success: false,
        message: 'FPT AI API key is not configured'
      });
    }

    const { frontImage, backImage } = req.files;
    const { documentType } = req.body;
    const userId = req.user.id;

    // Validate document type
    const validTypes = ['nationalId', 'passport', 'drivingLicense'];
    if (!validTypes.includes(documentType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid document type'
      });
    }

    // Validate files
    if (!frontImage?.[0] || !backImage?.[0]) {
      return res.status(400).json({
        success: false,
        message: 'Both front and back images are required'
      });
    }

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedTypes.includes(frontImage[0].mimetype) || !allowedTypes.includes(backImage[0].mimetype)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file format. Only PNG and JPG are allowed.'
      });
    }

    // Create upload directory if it doesn't exist
    try {
      await fsp.access(UPLOAD_DIR);
    } catch {
      await fsp.mkdir(UPLOAD_DIR, { recursive: true });
    }

    // Generate secure filenames
    const frontFileName = `${userId}-${documentType}-front-${Date.now()}.${frontImage[0].mimetype.split('/')[1]}`;
    const backFileName = `${userId}-${documentType}-back-${Date.now()}.${backImage[0].mimetype.split('/')[1]}`;
    const frontFilePath = path.join(UPLOAD_DIR, frontFileName);
    const backFilePath = path.join(UPLOAD_DIR, backFileName);

    // Save files
    const frontBuffer = await fsp.readFile(frontImage[0].path);
    const backBuffer = await fsp.readFile(backImage[0].path);
    await fsp.writeFile(frontFilePath, frontBuffer);
    await fsp.writeFile(backFilePath, backBuffer);

    // Process with FPT AI
    const formData = new FormData();
    formData.append('image', fs.createReadStream(frontFilePath));

    let fptResponse;
    if (documentType === 'nationalId') {
      fptResponse = await axios.post('https://api.fpt.ai/vision/idr/vnm', formData, {
        headers: {
          'api-key': FPT_API_KEY,
          'Content-Type': 'multipart/form-data',
          ...formData.getHeaders()
        }
      });
    } else if (documentType === 'passport') {
      fptResponse = await axios.post('https://api.fpt.ai/vision/passport/vnm', formData, {
        headers: {
          'api-key': FPT_API_KEY,
          'Content-Type': 'multipart/form-data',
          ...formData.getHeaders()
        }
      });
    } else if (documentType === 'drivingLicense') {
      fptResponse = await axios.post('https://api.fpt.ai/vision/dlr/vnm', formData, {
        headers: {
          'api-key': FPT_API_KEY,
          'Content-Type': 'multipart/form-data',
          ...formData.getHeaders()
        }
      });
    }

    const fptData = fptResponse.data;

    if (fptResponse.status === 200 && fptData.data && fptData.data.length > 0) {
      const extractedData = fptData.data[0];
      let documentNumber;

      // Extract document number based on document type
      switch (documentType) {
        case 'nationalId':
          documentNumber = extractedData.id;
          break;
        case 'passport':
          documentNumber = extractedData.passport_number;
          break;
        case 'drivingLicense':
          documentNumber = extractedData.license_number;
          break;
      }

      // Check for existing document number
      const existingVerification = await Verification.findOne({
        'verificationData.documentData.documentNumber': documentNumber
      });

      if (existingVerification) {
        await safeUnlink(frontFilePath);
        await safeUnlink(backFilePath);
        return res.status(400).json({
          success: false,
          message: 'This document number has already been registered'
        });
      }

      // Find or create verification record
      let verification = await Verification.findOne({ 
        userId,
        verificationType: 'kyc'
      });

      if (!verification) {
        await safeUnlink(frontFilePath);
        await safeUnlink(backFilePath);
        return res.status(404).json({
          success: false,
          message: 'Verification record not found'
        });
      }

      // Update document data
      verification.verificationData.documentData = {
        documentType,
        documentNumber,
        frontImageUrl: `/uploads/${frontFileName}`,
        backImageUrl: `/uploads/${backFileName}`,
        verificationStatus: 'pending',
        ocrData: {
          extractedFields: extractedData,
          confidence: fptData.confidence || 1,
          processedAt: new Date()
        }
      };

      // Mark document verification step as completed
      verification.completedSteps.documentVerification = {
        completed: true,
        completedAt: new Date(),
        attempts: (verification.completedSteps.documentVerification?.attempts || 0) + 1
      };

      await verification.save();

      // Update user's verification status
      await updateUserVerificationStatus(
        userId,
        verification.status,
        req.headers.authorization.split(' ')[1]
      );

      return res.status(200).json({
        success: true,
        message: 'Document processed successfully',
        data: verification.verificationData.documentData
      });
    } else {
      await safeUnlink(frontFilePath);
      await safeUnlink(backFilePath);
      return res.status(400).json({
        success: false,
        message: 'Document verification failed'
      });
    }
  } catch (error) {
    console.error('Error processing document:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process document',
      error: error.message
    });
  }
};

// Reset verification step
export const resetVerificationStep = async (req, res) => {
  try {
    const { step } = req.body;

    if (!step || !['faceVerification', 'documentVerification', 'videoVerification', 'voiceVerification'].includes(step)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid step specified'
      });
    }

    const verification = await Verification.findOne({ 
      userId: req.user.id,
      verificationType: 'kyc'
    });

    if (!verification) {
      return res.status(404).json({
        success: false,
        message: 'No verification record found'
      });
    }

    if (verification.status === 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Cannot reset steps for an approved verification'
      });
    }

    // Reset specified step
    verification.completedSteps[step].completed = false;

    // Remove related data
    if (step === 'faceVerification') {
      if (verification.verificationData.faceData?.imageUrl) {
        await deleteFile(verification.verificationData.faceData.imageUrl);
        verification.verificationData.faceData = {};
      }
    } else if (step === 'documentVerification') {
      if (verification.verificationData.documentData?.frontImageUrl) {
        await deleteFile(verification.verificationData.documentData.frontImageUrl);
      }
      if (verification.verificationData.documentData?.backImageUrl) {
        await deleteFile(verification.verificationData.documentData.backImageUrl);
      }
      verification.verificationData.documentData = {
        documentType: verification.verificationData.documentData?.documentType,
        verificationStatus: 'pending'
      };
    } else if (step === 'videoVerification') {
      if (verification.verificationData.videoData?.videoUrl) {
        await deleteFile(verification.verificationData.videoData.videoUrl);
        verification.verificationData.videoData = {};
      }
    } else if (step === 'voiceVerification') {
      if (verification.verificationData.voiceData?.audioUrl) {
        await deleteFile(verification.verificationData.voiceData.audioUrl);
        verification.verificationData.voiceData = {};
      }
    }

    // Set status back to pending if it was rejected
    if (verification.status === 'rejected') {
      verification.status = 'pending';
    }

    // Add to verification history
    verification.verificationHistory.push({
      action: 'reset-step',
      status: 'pending',
      notes: `Step ${step} reset for retry`,
      performedBy: req.user.id
    });

    await verification.save();

    // Update user's verification status
    await updateUserVerificationStatus(
      req.user.id,
      verification.status,
      req.headers.authorization.split(' ')[1]
    );

    res.json({
      success: true,
      data: {
        completedSteps: verification.completedSteps,
        status: verification.status
      }
    });
  } catch (error) {
    console.error('Verification step reset error:', error);
    res.status(500).json({
      success: false,
      message: 'Error resetting verification step'
    });
  }
};

// Get all verifications (Admin only)
export const getAllVerifications = async (req, res) => {
  try {
    const verifications = await Verification.find()
      .select('-verificationData.faceData.imageUrl -verificationData.videoData.videoUrl -verificationData.documentData.frontImageUrl -verificationData.documentData.backImageUrl')
      .sort({ createdAt: -1 });

    // Get user details from User service
    const verificationsWithUsers = await Promise.all(
      verifications.map(async (verification) => {
        try {
          const userResponse = await userService.get(
            `/api/users/${verification.userId}`,
            {
              headers: {
                Authorization: `Bearer ${req.headers.authorization.split(' ')[1]}`
              }
            }
          );
          return {
            ...verification.toObject(),
            user: userResponse.data.data
          };
        } catch (error) {
          console.error(`Error fetching user ${verification.userId}:`, error);
          return verification;
        }
      })
    );

    res.json({
      success: true,
      data: verificationsWithUsers
    });
  } catch (error) {
    console.error('Get all verifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching verifications'
    });
  }
};

// Verify KYC (Admin only)
export const verifyKYC = async (req, res) => {
  try {
    const { status, notes } = req.body;
    const verification = await Verification.findById(req.params.id);

    if (!verification) {
      return res.status(404).json({
        success: false,
        message: 'Verification record not found'
      });
    }

    verification.status = status;
    verification.verificationHistory.push({
      action: 'verification',
      status,
      notes,
      performedBy: req.user.id
    });

    await verification.save();

    // Update user's verification status
    await updateUserVerificationStatus(
      verification.userId,
      status,
      req.headers.authorization.split(' ')[1]
    );

    res.json({
      success: true,
      data: verification
    });
  } catch (error) {
    console.error('KYC verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying KYC'
    });
  }
}; 
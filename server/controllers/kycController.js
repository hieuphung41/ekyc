import KYC from '../models/KYC.js';
import User from '../models/User.js';
import { uploadMiddleware, deleteFile } from '../utils/fileUpload.js';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs/promises';

// @desc    Submit KYC application
// @route   POST /api/kyc/submit
// @access  Private
export const submitKYC = async (req, res) => {
    try {
        const { personalInfo, documents } = req.body;

        // Check if user already has a pending or approved KYC
        const existingKYC = await KYC.findOne({
            userId: req.user.id,
            status: { $in: ['pending', 'approved'] }
        });

        if (existingKYC) {
            return res.status(400).json({
                success: false,
                message: 'You already have a pending or approved KYC application'
            });
        }

        // Create KYC application
        const kyc = await KYC.create({
            userId: req.user.id,
            personalInfo,
            documents,
            expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year expiry
        });

        res.status(201).json({
            success: true,
            data: kyc
        });
    } catch (error) {
        console.error('KYC submission error:', error);
        res.status(500).json({
            success: false,
            message: 'Error submitting KYC application'
        });
    }
};

// @desc    Upload biometric data
// @route   POST /api/kyc/biometric
// @access  Private
export const uploadBiometric = async (req, res) => {
    try {
        const { type } = req.body; // 'face' or 'voice'
        const file = req.file;

        if (!file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        // Validate file type
        const allowedTypes = {
            face: ['image/jpeg', 'image/png'],
            voice: ['audio/mpeg', 'audio/wav']
        };

        if (!allowedTypes[type].includes(file.mimetype)) {
            await deleteFile(file.path);
            return res.status(400).json({
                success: false,
                message: `Invalid file type. Allowed types for ${type}: ${allowedTypes[type].join(', ')}`
            });
        }

        // Validate file size
        const maxSizes = {
            face: 5 * 1024 * 1024, // 5MB
            voice: 10 * 1024 * 1024 // 10MB
        };

        if (file.size > maxSizes[type]) {
            await deleteFile(file.path);
            return res.status(400).json({
                success: false,
                message: `File too large. Maximum size for ${type}: ${maxSizes[type] / (1024 * 1024)}MB`
            });
        }

        const kyc = await KYC.findOne({
            userId: req.user.id,
            status: 'pending'
        });

        if (!kyc) {
            await deleteFile(file.path);
            return res.status(404).json({
                success: false,
                message: 'No pending KYC application found'
            });
        }

        // Generate secure filename
        const fileExtension = path.extname(file.originalname);
        const secureFilename = `${crypto.randomBytes(16).toString('hex')}${fileExtension}`;
        
        // Create secure storage path
        const storageDir = path.join(process.cwd(), 'storage', 'biometric', type);
        await fs.mkdir(storageDir, { recursive: true });
        
        // Move file to secure location
        const securePath = path.join(storageDir, secureFilename);
        await fs.rename(file.path, securePath);

        // Delete old file if exists
        if (type === 'face' && kyc.biometricData.faceData?.imageUrl) {
            await deleteFile(kyc.biometricData.faceData.imageUrl);
        } else if (type === 'voice' && kyc.biometricData.voiceData?.audioUrl) {
            await deleteFile(kyc.biometricData.voiceData.audioUrl);
        }

        // Update biometric data based on type
        if (type === 'face') {
            kyc.biometricData.faceData = {
                imageUrl: securePath,
                verificationStatus: 'pending',
                confidence: 0,
                livenessScore: 0,
                uploadedAt: new Date(),
                fileType: file.mimetype,
                fileSize: file.size
            };
        } else if (type === 'voice') {
            kyc.biometricData.voiceData = {
                audioUrl: securePath,
                verificationStatus: 'pending',
                confidence: 0,
                uploadedAt: new Date(),
                fileType: file.mimetype,
                fileSize: file.size
            };
        }

        await kyc.save();

        res.json({
            success: true,
            data: {
                type,
                status: 'pending',
                uploadedAt: new Date()
            }
        });
    } catch (error) {
        console.error('Biometric upload error:', error);
        // Clean up file if it exists
        if (req.file?.path) {
            await deleteFile(req.file.path);
        }
        res.status(500).json({
            success: false,
            message: 'Error uploading biometric data'
        });
    }
};

// @desc    Get KYC status
// @route   GET /api/kyc/status
// @access  Private
export const getKYCStatus = async (req, res) => {
    try {
        const kyc = await KYC.findOne({ userId: req.user.id })
            .select('-biometricData')
            .sort({ createdAt: -1 });

        if (!kyc) {
            return res.status(404).json({
                success: false,
                message: 'No KYC application found'
            });
        }

        res.json({
            success: true,
            data: kyc
        });
    } catch (error) {
        console.error('KYC status error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching KYC status'
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
                message: 'KYC application not found'
            });
        }

        kyc.status = status;
        kyc.verificationHistory.push({
            action: 'verification',
            status,
            notes,
            performedBy: req.user.id
        });

        await kyc.save();

        res.json({
            success: true,
            data: kyc
        });
    } catch (error) {
        console.error('KYC verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Error verifying KYC application'
        });
    }
};

// @desc    Get all KYC applications (Admin only)
// @route   GET /api/kyc/all
// @access  Private/Admin
export const getAllKYC = async (req, res) => {
    try {
        const kycList = await KYC.find()
            .populate('userId', 'email firstName lastName')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            data: kycList
        });
    } catch (error) {
        console.error('Get all KYC error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching KYC applications'
        });
    }
}; 
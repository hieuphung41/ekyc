import { body } from 'express-validator';

export const kycSubmissionValidation = [
  body('documentType')
    .isIn(['passport', 'national_id', 'drivers_license'])
    .withMessage('Invalid document type'),
  body('documentNumber')
    .notEmpty()
    .withMessage('Document number is required'),
  body('documentImages.front')
    .notEmpty()
    .withMessage('Front document image is required'),
  body('documentImages.back')
    .notEmpty()
    .withMessage('Back document image is required'),
  body('documentImages.selfie')
    .notEmpty()
    .withMessage('Selfie image is required'),
  body('personalInfo.firstName')
    .notEmpty()
    .withMessage('First name is required'),
  body('personalInfo.lastName')
    .notEmpty()
    .withMessage('Last name is required'),
  body('personalInfo.dateOfBirth')
    .isISO8601()
    .withMessage('Invalid date of birth'),
  body('personalInfo.nationality')
    .notEmpty()
    .withMessage('Nationality is required'),
  body('personalInfo.address.street')
    .optional()
    .notEmpty()
    .withMessage('Street cannot be empty'),
  body('personalInfo.address.city')
    .optional()
    .notEmpty()
    .withMessage('City cannot be empty'),
  body('personalInfo.address.country')
    .optional()
    .notEmpty()
    .withMessage('Country cannot be empty'),
  body('personalInfo.address.postalCode')
    .optional()
    .notEmpty()
    .withMessage('Postal code cannot be empty')
];

export const kycVerificationValidation = [
  body('status')
    .isIn(['verified', 'rejected'])
    .withMessage('Invalid status'),
  body('verificationResult.faceMatch')
    .isBoolean()
    .withMessage('Face match result must be boolean'),
  body('verificationResult.documentAuthenticity')
    .isBoolean()
    .withMessage('Document authenticity result must be boolean'),
  body('verificationResult.livenessCheck')
    .isBoolean()
    .withMessage('Liveness check result must be boolean'),
  body('verificationNotes')
    .optional()
    .isString()
    .withMessage('Verification notes must be a string')
]; 
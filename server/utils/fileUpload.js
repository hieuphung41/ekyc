import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import multer from "multer";
import crypto from "crypto";
import path from "path";
import fs from "fs";

// Check if Cloudinary credentials are available
const hasCloudinaryCredentials =
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET;

let storage;

if (hasCloudinaryCredentials) {
  // Configure Cloudinary
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  // Configure Cloudinary storage
  storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: "ekyc",
      allowed_formats: ["jpg", "jpeg", "png", "pdf", "webm", "mp4"],
      public_id: (req, file) => {
        const fileId = crypto.randomBytes(16).toString("hex");
        const userId = req.user?.id || "anonymous";
        return `${userId}/${file.fieldname}-${fileId}`;
      },
    },
  });
} else {
  // Use memory storage instead of disk storage
  storage = multer.memoryStorage();
}

// File filter function
const fileFilter = (req, file, cb) => {
  // Define allowed file types
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/jpg",
    "application/pdf",
    "video/webm",
    "video/mp4",
    "audio/wav",
    "audio/mpeg",
    "audio/mp4",
    "audio/webm",
    "audio/webm;codecs=opus"
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    console.log("Rejected file type:", file.mimetype);
    cb(new Error("Invalid file type. Only JPEG, PNG, PDF, WebM, MP4, WAV, MP3, and M4A files are allowed."), false);
  }
};

// Configure upload middleware
const multerUpload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: fileFilter,
});

// Add error handling wrapper for multer
export const uploadMiddleware = {
  single: (fieldName) => {
    return (req, res, next) => {
      multerUpload.single(fieldName)(req, res, (err) => {
        if (err) {
          if (err instanceof multer.MulterError) {
            // A Multer error occurred during upload
            if (err.code === "LIMIT_FILE_SIZE") {
              return res.status(400).json({
                success: false,
                message: "File too large. Maximum size is 10MB.",
              });
            }
            return res.status(400).json({
              success: false,
              message: `Upload error: ${err.message}`,
            });
          }
          // An unknown error occurred
          return res.status(500).json({
            success: false,
            message: `Internal server error during file upload: ${err.message}`,
          });
        }

        // If we have a validation error from our filter
        if (req.fileValidationError) {
          return res.status(400).json({
            success: false,
            message: req.fileValidationError,
          });
        }

        // No error, proceed
        next();
      });
    };
  },
  fields: (fields) => {
    return (req, res, next) => {
      multerUpload.fields(fields)(req, res, (err) => {
        if (err) {
          if (err instanceof multer.MulterError) {
            // A Multer error occurred during upload
            if (err.code === "LIMIT_FILE_SIZE") {
              return res.status(400).json({
                success: false,
                message: "File too large. Maximum size is 10MB.",
              });
            }
            return res.status(400).json({
              success: false,
              message: `Upload error: ${err.message}`,
            });
          }
          // An unknown error occurred
          return res.status(500).json({
            success: false,
            message: `Internal server error during file upload: ${err.message}`,
          });
        }

        // If we have a validation error from our filter
        if (req.fileValidationError) {
          return res.status(400).json({
            success: false,
            message: req.fileValidationError,
          });
        }

        // No error, proceed
        next();
      });
    };
  },
};

// Helper function to delete file
export const deleteFile = async (filePath) => {
  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    console.error("Error deleting file:", error);
  }
};

export { cloudinary };

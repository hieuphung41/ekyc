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
  // Use memory storage with buffer
  storage = multer.memoryStorage({
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
    }
  });
}

// File filter function
const fileFilter = (req, file, cb) => {
  // Define allowed file types
  const allowedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "application/pdf",
    "video/webm",
    "video/mp4",
    "audio/wav",
    "audio/mpeg",
    "audio/mp4",
    "audio/webm",
    "audio/webm;codecs=opus"
  ];

  // Log the incoming file type for debugging
  console.log('Processing file:', {
    originalname: file.originalname,
    mimetype: file.mimetype
  });

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    console.log("Rejected file type:", file.mimetype);
    cb(new Error("Invalid file type. Only JPEG, PNG, PDF, WebM, MP4, WAV, MP3, and M4A files are allowed."), false);
  }
};

// Create multer instance
const multerInstance = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

// Export middleware functions
export const uploadMiddleware = {
  single: (fieldName) => {
    return (req, res, next) => {
      multerInstance.single(fieldName)(req, res, (err) => {
        if (err) {
          console.error('Multer error:', err);
          return res.status(400).json({
            success: false,
            message: err.message
          });
        }
        // Log the processed file
        if (req.file) {
          console.log('Multer processed file details:', {
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            hasBuffer: req.file.buffer ? true : false,
            bufferSize: req.file.buffer?.length
          });
        }
        next();
      });
    };
  },
  fields: (fields) => {
    return (req, res, next) => {
      multerInstance.fields(fields)(req, res, (err) => {
        if (err) {
          console.error('Multer error:', err);
          return res.status(400).json({
            success: false,
            message: err.message
          });
        }
        next();
      });
    };
  }
};

// Helper function to delete temporary files
export const deleteFile = async (filePath) => {
  try {
    if (filePath && fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
  } catch (error) {
    console.error("Error deleting file:", error);
  }
};

export { cloudinary };

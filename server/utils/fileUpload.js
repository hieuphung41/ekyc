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
  // Create uploads directory if it doesn't exist
  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Configure local disk storage
  storage = multer.diskStorage({
    destination: function (req, file, cb) {
      const userId = req.user?.id || "anonymous";
      const userDir = path.join(process.cwd(), "uploads", userId);

      if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
      }

      cb(null, userDir);
    },
    filename: function (req, file, cb) {
      const fileId = crypto.randomBytes(16).toString("hex");
      cb(null, `${file.fieldname}-${fileId}${path.extname(file.originalname)}`);
    },
  });
}

// File filter function with detailed error handling
const fileFilter = (req, file, cb) => {
  // Allow different file types based on the fieldname
  if (file.fieldname === "faceVideo" || file.fieldname === "videoFile") {
    // Video files for face verification
    if (
      file.mimetype.startsWith("video/") ||
      file.mimetype === "application/octet-stream" || // For blob uploads sometimes
      file.originalname.endsWith(".webm") ||
      file.originalname.endsWith(".mp4")
    ) {
      return cb(null, true);
    }
    // Video-specific error
    req.fileValidationError =
      "Invalid video format. Please use a supported video format like WebM or MP4.";
    return cb(null, false);
  } else {
    // Image or PDF for other uploads (like ID card)
    if (
      file.mimetype.startsWith("image/") ||
      file.mimetype === "application/pdf"
    ) {
      return cb(null, true);
    }
    // Image-specific error
    req.fileValidationError =
      "Invalid file type. Only images and PDFs are allowed for this field.";
    return cb(null, false);
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

// Function to delete file (works with both Cloudinary and local storage)
export const deleteFile = async (filePath) => {
  try {
    if (hasCloudinaryCredentials && filePath.includes("cloudinary")) {
      await cloudinary.uploader.destroy(filePath);
    } else {
      // For local storage
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    return true;
  } catch (error) {
    console.error("Error deleting file:", error);
    return false;
  }
};

export { cloudinary };

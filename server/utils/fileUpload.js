import multer from "multer";
import path from "path";
import { CONTAINERS } from "../config/constants.js";

// Configure multer for memory storage
const storage = multer.memoryStorage();

// File filter function
const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
  console.log('Incoming file type:', {
    originalname: file.originalname,
    mimetype: file.mimetype
  });

  if (allowedTypes.includes(file.mimetype)) {
    // Force JPEG mime type
    file.mimetype = "image/jpeg";
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only JPEG and PNG are allowed."), false);
  }
};

// Create multer instance with memory storage
const multerInstance = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Export middleware with error handling
export const uploadMiddleware = {
  single: (fieldName) => {
    return (req, res, next) => {
      multerInstance.single(fieldName)(req, res, (err) => {
        if (err) {
          console.error("Multer error:", err);
          return res.status(400).json({
            success: false,
            message: err.message,
          });
        }

        // Log processed file details
        if (req.file) {
          console.log("Multer processed file details:", {
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            hasBuffer: !!req.file.buffer,
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
          console.error("Multer error:", err);
          return res.status(400).json({
            success: false,
            message: err.message,
          });
        }

        // Log processed files details
        if (req.files) {
          Object.keys(req.files).forEach(fieldName => {
            req.files[fieldName].forEach(file => {
              console.log(`Multer processed ${fieldName} file:`, {
                originalname: file.originalname,
                mimetype: file.mimetype,
                size: file.size,
                hasBuffer: !!file.buffer,
                bufferSize: file.buffer?.length
              });
            });
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

import multer from "multer";
import path from "path";
import fs from "fs";

// Define containers for different file types
const CONTAINERS = {
  FACE: "face-verification",
  DOCUMENT: "document-verification",
  VOICE: "voice-verification",
  VIDEO: "video-verification"
};

// Define allowed content types for each container
const ALLOWED_CONTENT_TYPES = {
  [CONTAINERS.FACE]: ["image/jpeg", "image/jpg", "image/png"],
  [CONTAINERS.DOCUMENT]: ["image/jpeg", "image/png", "image/jpg", "application/pdf"],
  [CONTAINERS.VOICE]: ["audio/wav", "audio/webm", "audio/mp4"],
  [CONTAINERS.VIDEO]: ["video/webm", "video/mp4"]
};

// Configure multer for memory storage
const storage = multer.memoryStorage();

// File filter function
const fileFilter = (req, file, cb) => {
  // Determine container type from request path
  let containerType;
  if (req.path.includes('/face')) {
    containerType = CONTAINERS.FACE;
  } else if (req.path.includes('/document')) {
    containerType = CONTAINERS.DOCUMENT;
  } else if (req.path.includes('/voice')) {
    containerType = CONTAINERS.VOICE;
  } else if (req.path.includes('/video')) {
    containerType = CONTAINERS.VIDEO;
  }

  console.log('Incoming file type:', {
    originalname: file.originalname,
    mimetype: file.mimetype,
    containerType
  });

  if (!containerType) {
    return cb(new Error("Invalid upload endpoint"), false);
  }

  const allowedTypes = ALLOWED_CONTENT_TYPES[containerType];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Allowed types for ${containerType}: ${allowedTypes.join(', ')}`), false);
  }
};

// Create multer instance with memory storage
const multerInstance = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for video files
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

// Export CONTAINERS for use in other files
export { CONTAINERS };

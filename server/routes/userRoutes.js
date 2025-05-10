import express from "express";
import {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
} from "../controllers/userController.js";
import { protect } from "../middlewares/auth.js";
import {
  validateRegistration,
  validateLogin,
  validate,
} from "../middlewares/validator.js";

const router = express.Router();

// Public routes
router.post("/register", validateRegistration, validate, register);
router.post("/login", validateLogin, validate, login);

// Protected routes
router.get("/profile", protect, getProfile);
router.put("/profile", protect, updateProfile);
router.put("/change-password", protect, changePassword);

export default router;

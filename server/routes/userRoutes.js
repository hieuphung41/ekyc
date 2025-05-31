import express from "express";
import {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  logout,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  getAdminStats,
  createUser,
} from "../controllers/userController.js";
import { protect, authorize } from "../middlewares/auth.js";
import {
  validateRegistration,
  validateLogin,
  validate,
} from "../middlewares/validator.js";

const router = express.Router();

// Public routes
router.post("/register", validateRegistration, validate, register);
router.post("/login", validateLogin, validate, login);
router.post("/logout", protect, logout);

// Protected routes
router.get("/profile", protect, getProfile);
router.put("/profile", protect, updateProfile);
router.put("/change-password", protect, changePassword);

// Admin routes - Note: More specific routes should come before parameterized routes
router.get("/admin/stats", protect, authorize("admin"), getAdminStats);
router.get("/", protect, authorize("admin"), getAllUsers);
router.post("/", protect, authorize("admin"), createUser);
router.get("/:id", protect, authorize("admin"), getUserById);
router.put("/:id", protect, authorize("admin"), updateUser);
router.delete("/:id", protect, authorize("admin"), deleteUser);

export default router;

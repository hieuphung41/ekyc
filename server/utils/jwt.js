import jwt from "jsonwebtoken";

export const generateToken = (user) => {
  // For API clients, we need to ensure we're using _id
  const payload = {
    id: user._id || user.id, // Handle both _id and id
    email: user.email,
    role: user.role || user.representative?.role || 'user', // Get role from user or representative
  };

  return jwt.sign(
    payload,
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRE,
    }
  );
};

export const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Ensure we have the required fields
    if (!decoded.id || !decoded.role) {
      throw new Error("Invalid token payload");
    }
    return decoded;
  } catch (error) {
    console.error("Token verification error:", error);
    return null;
  }
};

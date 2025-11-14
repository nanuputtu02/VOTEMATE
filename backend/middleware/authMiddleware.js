const jwt = require("jsonwebtoken");
require("dotenv").config();

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    console.error("JWT verification failed:", err.message);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

// ✅ Admin-only routes
const requireAdmin = (req, res, next) => {
  if (req.user && req.user.role === "admin") return next();
  console.warn(`🚫 Unauthorized access by ${req.user?.email || "unknown user"}`);
  return res.status(403).json({ message: "Admin access required" });
};

module.exports = { authenticate, requireAdmin };

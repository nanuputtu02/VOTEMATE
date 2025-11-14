const express = require("express");
const passport = require("passport");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const router = express.Router();
require("dotenv").config();

// Start Google OAuth
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// ✅ Google OAuth callback (fixed role consistency)
router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/auth/failure", session: false }),
  async (req, res) => {
    try {
      // Always fetch latest user from DB
      const user = await User.findOne({ email: req.user.email });
      if (!user) return res.redirect("/auth/failure");

      // ✅ Generate JWT with updated role
      const payload = { id: user._id, email: user.email, role: user.role };
      const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });

      // ✅ Redirect based on role
      let redirectUrl = `http://localhost:5000/?token=${token}`;
      if (user.role === "admin") {
        redirectUrl = `http://localhost:5000/admin-dashboard.html?token=${token}`;
      } else if (user.role === "student") {
        redirectUrl = `http://localhost:5000/voter-dashboard.html?token=${token}`;
      }

      res.redirect(redirectUrl);
    } catch (error) {
      console.error("OAuth callback error:", error);
      res.redirect("/auth/failure");
    }
  }
);

// Optional failure route
router.get("/failure", (req, res) => {
  res.status(401).json({
    message:
      "Authentication failed. Only @vvce.ac.in (students) or @gmail.com (admins) allowed.",
  });
});

// Logout endpoint
router.get("/logout", (req, res) => {
  req.logout?.();
  res.json({ message: "Logged out" });
});

module.exports = router;

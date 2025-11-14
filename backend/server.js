const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const bodyParser = require("body-parser");
const passport = require("passport");
const session = require("express-session");
const path = require("path");

// Load environment variables
dotenv.config();

// Debug logs
console.log("🧩 DEBUG -> Current Directory:", process.cwd());
console.log("🧩 DEBUG -> MONGO_URI:", process.env.MONGO_URI);

// Connect MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch((err) => console.error("❌ MongoDB connection error:", err.message));

// Initialize Express
const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Session setup
app.use(
  session({
    secret: process.env.JWT_SECRET || "votemate_secret_key",
    resave: false,
    saveUninitialized: false,
  })
);

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());
require("./config/passport");

// Import routes
const googleAuthRoutes = require("./routes/googleAuthRoutes");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const studentRoutes = require("./routes/studentRoutes");

// Use routes, including Google OAuth
app.use("/auth", googleAuthRoutes);
app.use("/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/student", studentRoutes);

// Redirect root to Google OAuth login
app.get("/", (req, res) => {
  res.redirect("/auth/google");
});

// Serve frontend static files AFTER redirect rule
app.use(express.static(path.join(__dirname, "../frontend")));

// Handle 404 routes
app.use((req, res) => {
  res.status(404).send("❌ Route not found or invalid endpoint.");
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Server running successfully on http://localhost:${PORT}`)
);

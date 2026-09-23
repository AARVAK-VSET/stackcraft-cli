const express = require("express");
const rateLimit = require("express-rate-limit");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const authRoutes = require("./routes/authRoutes.js");


dotenv.config();

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  console.error("FATAL: JWT_SECRET is missing or too weak (minimum 16 characters). Set a strong secret in .env before starting the server.");
  process.exit(1);
}

const app = express();
const mongoURI = process.env.MONGO_URI;
const port = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));

const authLimiter = rateLimit({                         
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts, please try again later." },
});

// Routes
app.use("/api/auth", authLimiter, authRoutes); 

// Safe MongoDB connection for scaffold
if (!mongoURI || mongoURI === "your_mongodb_uri_here") {
  console.warn("⚠️  No Mongo URI provided. Skipping DB connection. You can set it in .env later.");
  app.listen(port, () => console.log(`Server running without DB on port ${port}`));
} else {
  mongoose
    .connect(mongoURI)
    .then(() => {
      console.log("MongoDB connected");
      app.listen(port, () => console.log(`Server running on port ${port}`));
    })
    .catch((err) => {
      console.error("MongoDB connection failed:", err.message);
      app.listen(port, () => console.log(`Server running without DB on port ${port}`));
    });
}
module.exports = app;

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pool, { testConnection } from "./config/database.js";
import { initDatabase } from "./models/initDatabase.js";
import { startScheduler } from "./services/schedulerService.js";

// Routes
import authRoutes from "./routes/authRoutes.js";
import instagramRoutes from "./routes/instagramRoutes.js";
import postRoutes from "./routes/postRoutes.js";

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check route
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// API Routes
app.use("/auth", authRoutes);
app.use("/instagram", instagramRoutes);
app.use("/posts", postRoutes);

// Initialize database and start server
const startServer = async () => {
  try {
    // Test database connection
    await testConnection();
    
    // Initialize database schema
    await initDatabase();
    
    // Start scheduler
    startScheduler();
    
    // Start server
    const PORT = process.env.PORT || 8080;
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
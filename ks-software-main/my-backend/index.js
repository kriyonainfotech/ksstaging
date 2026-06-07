process.env.TZ = "Asia/Kolkata";
const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
const path = require("path");
const helmet = require("helmet");
// Load env
dotenv.config();
connectDB();

const startNotificationJob = require("./jobs/notificationJob");
const startCleanupJob = require("./jobs/cleanupJob");

const app = express();
app.use(cookieParser());
startNotificationJob();
startCleanupJob();

app.use(express.json());
app.use(cors({
    origin: [
        "http://localhost:3000",
        "http://localhost:3001",
        "https://ks-software.vercel.app",
        "https://crmkriyonastudio.vercel.app",
        "https://crm.kriyonastudio.com",
        "https://admin.kriyonastudio.com"
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "X-CSRF-Token", "x-company-id"]
}));

// mongoose.connection.once('open', () => {
//     console.log('Connected to MongoDB');
// });

// Test route
app.get("/", (req, res) => {
    res.send("Backend is Live hello world🚀");
});

// Routes
app.use("/api", require("./routes/indexRoute"));

// Server
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

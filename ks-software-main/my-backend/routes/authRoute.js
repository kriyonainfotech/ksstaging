const express = require("express");
const { register, login, me, updateProfile, removeProfilePic, adminLogin, getUserPassword, SPadminLogin } = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");
const { refreshToken } = require("../controllers/authController");
const router = express.Router();

const upload = require("../middleware/upload");

router.post("/register", register);
router.post("/login", login);
router.post("/me", protect, me);
router.put("/edit-profile", protect, (req, res, next) => {
    upload.single("profilePic")(req, res, (err) => {
        if (err) {
            console.log("❌ MULTER/CLOUDINARY UPLOAD ERROR:", err.message);

            // Multer file size limit exceeded
            if (err.code === "LIMIT_FILE_SIZE") {
                const maxMB = 5;
                return res.status(400).json({
                    success: false,
                    message: `File is too large. Maximum allowed size is ${maxMB}MB. Please compress or resize your image.`
                });
            }

            // Cloudinary file size limit
            if (err.message && err.message.includes("File size too large")) {
                const match = err.message.match(/Got (\d+)/);
                const gotBytes = match ? parseInt(match[1]) : 0;
                const gotMB = (gotBytes / (1024 * 1024)).toFixed(1);
                return res.status(400).json({
                    success: false,
                    message: `File is too large (${gotMB}MB). Maximum allowed size is 5MB. Please compress or resize your image.`
                });
            }

            return res.status(500).json({
                success: false,
                message: "File upload failed: " + err.message
            });
        }
        next();
    });
}, updateProfile);
router.delete("/remove-profile-pic", protect, removeProfilePic);
router.post("/admin-login", adminLogin);
router.post("/panel-login", SPadminLogin);
router.post("/refresh-token", refreshToken);
router.post("/get-password", getUserPassword);

module.exports = router;
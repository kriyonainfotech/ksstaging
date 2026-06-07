const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

// 🔥 dynamic folder based on role or route
const storage = new CloudinaryStorage({
    cloudinary,
    params: (req, file) => {
        let folder = "profiles"; // fallback

        if (req.body.role) {
            folder = `profiles/${req.body.role.toLowerCase()}`;
        } else if (req.user?.role) {
            folder = `profiles/${req.user.role.toLowerCase()}`;
        }

        return {
            folder,
            allowed_formats: ["jpg", "jpeg", "png", "webp"],
        };
    },
});

const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max
    },
});

module.exports = upload;

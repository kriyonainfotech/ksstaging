const express = require("express");
const router = express.Router();
const {
    getPointsByGroup,
    createPoint,
    updatePoint,
    deletePoint,
    reorderPoints
} = require("../controllers/sopPointController");
const { protect, authorize } = require("../middleware/authMiddleware");

// Basic protection
router.use(protect);

// GET requests are allowed for Admin, Team and Superadmin
router.get("/", authorize("Superadmin", "Admin", "Team"), getPointsByGroup);

// Mutation routes are Superadmin only
router.use(authorize("Superadmin"));

router.post("/", createPoint);
router.put("/:id", updatePoint);
router.delete("/:id", deletePoint);
router.post("/reorder", reorderPoints);

module.exports = router;

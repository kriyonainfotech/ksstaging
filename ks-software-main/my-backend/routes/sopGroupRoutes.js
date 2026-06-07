const express = require("express");
const router = express.Router();
const {
    getGroups,
    createGroup,
    updateGroup,
    deleteGroup,
    reorderGroups
} = require("../controllers/sopGroupController");
const { protect, authorize } = require("../middleware/authMiddleware");

// Basic protection
router.use(protect);

// GET requests are allowed for Admin, Team and Superadmin
router.get("/", authorize("Superadmin", "Admin", "Team"), getGroups);

// Mutation routes are Superadmin only
router.use(authorize("Superadmin"));

router.post("/", createGroup);
router.put("/:id", updateGroup);
router.delete("/:id", deleteGroup);
router.post("/reorder", reorderGroups);

module.exports = router;

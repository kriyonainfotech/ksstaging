const express = require("express");
const { protect, hasPermission } = require("../middleware/authMiddleware");
const {
    createSubscription,
    getClientSubscriptions,
    renewSubscription,
    cancelSubscription,
    updateSubscription,
    getSubscriptionDeletionPreview,
    deleteSubscription
} = require("../controllers/subscriptionController");

const router = express.Router();

router.use(protect);

// 1. Assign (Create)
router.post("/assign", hasPermission("subscription.create"), createSubscription);

// 2. View (Client's active plans)
router.get("/client/:id", hasPermission("subscription.view"), getClientSubscriptions);

// 3. Update
router.patch("/:id", hasPermission("subscription.update"), updateSubscription);

// Preview Deletion
router.get("/:id/deletion-preview", hasPermission("subscription.delete"), getSubscriptionDeletionPreview);

// Delete (Permanent)
router.delete("/:id", hasPermission("subscription.delete"), deleteSubscription);

// 3. Renew
router.post("/:id/renew", hasPermission("subscription.renew"), renewSubscription);

// 4. Cancel
router.post("/:id/cancel", hasPermission("subscription.cancel"), cancelSubscription);

// Note: 'Edit' (PUT /:id) logic is similar to renew but updates the existing doc
// You can add that if you need to change quantity mid-month.

module.exports = router;
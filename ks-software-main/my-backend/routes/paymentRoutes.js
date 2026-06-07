const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
    createSale,
    collectPayment,
    recordExpense,
    getSales,
    getCollections,
    getStats,
    updateSale,
    deleteSale,
    updateExpense,
    deleteExpense,
    deleteCollection,
    updateCollectionAccount,
    createDirectCollection,
    updateDirectCollection
} = require("../controllers/paymentController");

// Protect all routes
router.use(protect);

// Stats
router.get("/stats", getStats);

// Sales (Invoices)
router.post("/sales", createSale);
router.get("/sales", getSales);
router.put("/sales/:id", updateSale);
router.delete("/sales/:id", deleteSale);

// Collections (Transactions)
router.post("/collect", collectPayment);
router.post("/expense", recordExpense);
router.put("/expense/:id", updateExpense);
router.delete("/expense/:id", deleteExpense);
router.delete("/collection/:id", deleteCollection);
router.put("/collection/:id/account", updateCollectionAccount);
router.post("/direct-collection", createDirectCollection);
router.put("/direct-collection/:id", updateDirectCollection);
router.get("/collections", getCollections);

module.exports = router;
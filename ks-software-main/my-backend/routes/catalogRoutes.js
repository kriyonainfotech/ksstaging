const express = require("express");
const { protect, hasPermission } = require("../middleware/authMiddleware");
const {
    getServices,
    createService,
    updateService,
    deleteService,
    getPackages,
    createPackage,
    updatePackage,
    deletePackage,
} = require("../controllers/catalogController");

const router = express.Router();

// Apply Identity Check to all routes
router.use(protect);

// ---------------------- SERVICES ----------------------

router.get("/services/view", hasPermission("catalog.view"), getServices);
router.post("/services/create", hasPermission("catalog.manage"), createService);
router.put("/services/update/:id", hasPermission("catalog.manage"), updateService);
router.delete("/services/delete/:id", hasPermission("catalog.manage"), deleteService);

// ---------------------- PACKAGES ----------------------

router.get("/packages/view", hasPermission("catalog.view"), getPackages);
router.post("/packages/create", hasPermission("catalog.manage"), createPackage);
router.put("/packages/update/:id", hasPermission("catalog.manage"), updatePackage);
router.delete("/packages/delete/:id", hasPermission("catalog.manage"), deletePackage);

module.exports = router;

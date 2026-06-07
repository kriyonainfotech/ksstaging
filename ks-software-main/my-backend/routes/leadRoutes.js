const express = require("express");
const router = express.Router();
const leadController = require("../controllers/leadController");
const { protect, hasPermission } = require("../middleware/authMiddleware");

// Apply protection to all lead routes
router.use(protect);

// Lead CRUD
router.get("/view", hasPermission("lead.view"), leadController.getAllLeads);
router.post("/create", hasPermission("lead.manage"), leadController.createLead);
router.put("/update/:id", hasPermission("lead.manage"), leadController.updateLead);
router.delete("/delete/:id", hasPermission("lead.manage"), leadController.deleteLead);

// Configs
router.get("/configs", hasPermission("lead.view"), leadController.getLeadConfigs);
router.post("/configs/option", hasPermission("lead.manage"), leadController.addLeadConfigOption);
router.delete("/configs/:name/option/:optionId", hasPermission("lead.manage"), leadController.deleteLeadConfigOption);

module.exports = router;

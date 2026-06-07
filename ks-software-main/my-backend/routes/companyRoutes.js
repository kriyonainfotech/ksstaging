const express = require("express");
const { protect, authorize } = require("../middleware/authMiddleware");
const {
    createCompany,
    getCompanies,
    updateCompany,
    deleteCompany
} = require("../controllers/companyController");

const router = express.Router();

router.use(protect);

router.route("/")
    .get(getCompanies)
    .post(authorize("Superadmin"), createCompany);

router.route("/:id")
    .put(authorize("Superadmin"), updateCompany)
    .delete(authorize("Superadmin"), deleteCompany);

module.exports = router;

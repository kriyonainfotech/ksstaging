const Company = require("../models/Company");
const User = require("../models/user");

// @desc    Create a new company
// @route   POST /api/companies
// @access  Superadmin
exports.createCompany = async (req, res) => {
    try {
        const { name, ownerId } = req.body;

        // Validation
        if (!name) {
            return res.status(400).json({ success: false, message: "Company name is required" });
        }

        const company = await Company.create({
            name,
            owner: ownerId || null,
            admins: req.body.adminIds || (ownerId ? [ownerId] : [])
        });

        res.status(201).json({ success: true, data: company });

    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: "Company name already exists" });
        }
        res.status(500).json({ success: false, error: error.message });
    }
};

// @desc    Get all companies
// @route   GET /api/companies
// @access  Superadmin (or authenticated users based on need)
exports.getCompanies = async (req, res) => {
    try {
        const companies = await Company.find().populate("owner", "name email").populate("admins", "name email");
        res.status(200).json({ success: true, data: companies });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// @desc    Update company
// @route   PUT /api/companies/:id
// @access  Superadmin
exports.updateCompany = async (req, res) => {
    try {
        const { name, ownerId } = req.body;

        const company = await Company.findById(req.params.id);
        if (!company) {
            return res.status(404).json({ success: false, message: "Company not found" });
        }

        if (name) company.name = name;
        if (ownerId) company.owner = ownerId;
        
        if (req.body.adminIds) {
            company.admins = req.body.adminIds;
        }

        // Ensure owner is always in admins list
        if (company.owner && !company.admins.includes(company.owner.toString())) {
            company.admins.push(company.owner);
        }

        await company.save();

        res.status(200).json({ success: true, data: company });

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// @desc    Delete company
// @route   DELETE /api/companies/:id
// @access  Superadmin
exports.deleteCompany = async (req, res) => {
    try {
        await Company.findByIdAndDelete(req.params.id);
        res.status(200).json({ success: true, message: "Company deleted" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

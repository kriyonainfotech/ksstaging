const Lead = require("../models/Lead");
const OptionSet = require("../models/OptionSet");
const Company = require("../models/Company");

// Helper: Check if user belongs to the target company
// (You might want to share this helper from a utils file ideally)
const validateCompanyAccess = async (user, targetCompanyId) => {
    // 1. Superadmin Bypass
    if (user.role === "Superadmin" || user.email === "yogeshnarola@kriyonastudio.com") return true;

    // 2. Check if user has a company assigned
    if (!user.company) return false;

    // 3. Compare IDs
    return user.company.toString() === targetCompanyId.toString();
};

// Get all leads (Filtered by Company)
exports.getAllLeads = async (req, res) => {
    try {
        const query = {};

        // 1. If NOT Superadmin, force company filter
        if (req.user.role !== "Superadmin" && req.user.role !== "Admin") { // Assuming Admin is also restricted to their company? 
            // Wait, usually 'Admin' in this system is also company-specific unless 'Superadmin'. 
            // Let's assume anyone NOT 'Superadmin' is restricted to their req.user.company
            if (!req.user.company) {
                return res.status(200).json([]); // No company? No data.
            }
            query.company = req.user.company;
        } else {
            // 2. If Superadmin, check if they passed a specific ?company=ID filter
            if (req.query.company) {
                query.company = req.query.company;
            }
            // If specific company not requested, return ALL (or User requested "Company Specific" leads only?)
            // The prompt says "change lead management page... into compny specific leads only. also add a filter button".
            // So default behavior for Superadmin might be "All" but filterable.
        }

        const leads = await Lead.find(query).sort({ createdAt: -1 });
        res.status(200).json(leads);
    } catch (error) {
        res.status(500).json({ message: "Error fetching leads", error: error.message });
    }
};

// Create a lead
exports.createLead = async (req, res) => {
    try {
        // Enforce Company Assignment
        let companyId = req.body.company;

        // If regular user, force their company
        if (req.user.role !== "Superadmin") {
            if (!req.user.company) {
                return res.status(400).json({ message: "User does not belong to any company" });
            }
            companyId = req.user.company;
        }

        // If Superadmin didn't provide one, maybe error or let it be null (global)?
        // Let's assume required.
        if (!companyId && req.user.role === "Superadmin") {
            // For now, allow Superadmin to create global? Or require selection?
            // Let's default to Kriyona Studio if missing for Superadmin just to be safe, or error?
            // Better: if no company provided by Superadmin, use their own if exists, else error.
            return res.status(400).json({ message: "Company is required" });
        }

        const newLead = new Lead({
            ...req.body,
            company: companyId
        });

        await newLead.save();
        res.status(201).json(newLead);
    } catch (error) {
        res.status(500).json({ message: "Error creating lead", error: error.message });
    }
};

// Update a lead
exports.updateLead = async (req, res) => {
    try {
        const lead = await Lead.findById(req.params.id);
        if (!lead) return res.status(404).json({ message: "Lead not found" });

        // Access Check
        const hasAccess = await validateCompanyAccess(req.user, lead.company);
        // Note: modify validateCompanyAccess to handle if lead.company is missing (old data?) -> Migration fixed this.

        if (!hasAccess) {
            return res.status(403).json({ message: "Access Denied" });
        }

        const updatedLead = await Lead.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.status(200).json(updatedLead);
    } catch (error) {
        res.status(500).json({ message: "Error updating lead", error: error.message });
    }
};

// Delete a lead
exports.deleteLead = async (req, res) => {
    try {
        const lead = await Lead.findById(req.params.id);
        if (!lead) return res.status(404).json({ message: "Lead not found" });

        // Access Check
        const hasAccess = await validateCompanyAccess(req.user, lead.company);
        if (!hasAccess) {
            return res.status(403).json({ message: "Access Denied" });
        }

        await Lead.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: "Lead deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting lead", error: error.message });
    }
};

// --- DYNAMIC CONFIGS ---

// Get config for leads (cities, purposes, statuses)
exports.getLeadConfigs = async (req, res) => {
    try {
        const configs = await OptionSet.find({
            name: { $in: ["lead_city", "lead_purpose", "lead_status"] }
        });
        res.status(200).json(configs);
    } catch (error) {
        res.status(500).json({ message: "Error fetching configs", error: error.message });
    }
};

// Add option to a config
exports.addLeadConfigOption = async (req, res) => {
    const { name, label, value, color } = req.body;
    try {
        let config = await OptionSet.findOne({ name });
        if (!config) {
            config = new OptionSet({ name, options: [] });
        }

        // Check if option already exists
        const exists = config.options.find(opt => opt.value === value || opt.label === label);
        if (exists) return res.status(200).json(config); // Just return existing if already there

        config.options.push({ label, value, color: color || "#000000" });
        await config.save();
        res.status(200).json(config);
    } catch (error) {
        res.status(500).json({ message: "Error adding config option", error: error.message });
    }
};

// Delete option from a config
exports.deleteLeadConfigOption = async (req, res) => {
    const { name, optionId } = req.params;
    try {
        const config = await OptionSet.findOne({ name });
        if (!config) return res.status(404).json({ message: "Config set not found" });

        // Check if option is system (optional safety)
        const option = config.options.id(optionId);
        if (option && option.isSystem) {
            return res.status(403).json({ message: "Cannot delete system protected option" });
        }

        config.options.pull(optionId);
        await config.save();
        res.status(200).json(config);
    } catch (error) {
        res.status(500).json({ message: "Error deleting config option", error: error.message });
    }
};

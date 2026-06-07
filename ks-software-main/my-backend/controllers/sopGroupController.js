const SopGroup = require("../models/SopGroup");
const SopPoint = require("../models/SopPoint");

// @desc    Get all SOP groups for an entity
// @route   GET /api/sop-groups
exports.getGroups = async (req, res) => {
    try {
        const { entityType, entityId, teamCategory, category } = req.query;
        
        // --- MULTI-COMPANY ISOLATION ---
        // Fetch SOPs belonging to the current company context OR legacy global SOPs
        let query = { 
            category,
            $or: [
                { company: req.user.activeCompany },
                { company: { $exists: false } }
            ]
        };

        if (entityType) query.entityType = entityType;
        if (entityId && entityId !== "null" && entityId !== "undefined") query.entityId = entityId;
        if (teamCategory) query.teamCategory = teamCategory;

        const groups = await SopGroup.find(query).sort({ order: 1 });
        res.status(200).json({ success: true, data: groups });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// @desc    Create SOP group
// @route   POST /api/sop-groups
exports.createGroup = async (req, res) => {
    try {
        const group = await SopGroup.create({
            ...req.body,
            createdBy: req.user._id,
            company: req.user.activeCompany
        });
        res.status(201).json({ success: true, data: group });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// @desc    Update SOP group
// @route   PUT /api/sop-groups/:id
exports.updateGroup = async (req, res) => {
    try {
        const group = await SopGroup.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });
        if (!group) return res.status(404).json({ success: false, message: "Group not found" });
        res.status(200).json({ success: true, data: group });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// @desc    Delete SOP group and its points
// @route   DELETE /api/sop-groups/:id
exports.deleteGroup = async (req, res) => {
    try {
        const group = await SopGroup.findByIdAndDelete(req.params.id);
        if (!group) return res.status(404).json({ success: false, message: "Group not found" });

        // Delete associated points
        await SopPoint.deleteMany({ groupId: req.params.id });

        res.status(200).json({ success: true, message: "Group and associated points deleted" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// @desc    Reorder groups
// @route   POST /api/sop-groups/reorder
exports.reorderGroups = async (req, res) => {
    try {
        const { orders } = req.body; // Array of { id, order }
        const bulkOps = orders.map(item => ({
            updateOne: {
                filter: { _id: item.id },
                update: { order: item.order }
            }
        }));

        await SopGroup.bulkWrite(bulkOps);
        res.status(200).json({ success: true, message: "Groups reordered" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

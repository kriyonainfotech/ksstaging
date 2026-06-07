const SopPoint = require("../models/SopPoint");

// @desc    Get all points for a group
// @route   GET /api/sop-points
exports.getPointsByGroup = async (req, res) => {
    try {
        const { groupId } = req.query;
        if (!groupId) return res.status(400).json({ success: false, message: "GroupId is required" });

        const points = await SopPoint.find({ groupId }).sort({ order: 1 });
        res.status(200).json({ success: true, data: points });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// @desc    Create SOP point
// @route   POST /api/sop-points
exports.createPoint = async (req, res) => {
    try {
        const point = await SopPoint.create(req.body);
        res.status(201).json({ success: true, data: point });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// @desc    Update SOP point
// @route   PUT /api/sop-points/:id
exports.updatePoint = async (req, res) => {
    try {
        const point = await SopPoint.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });
        if (!point) return res.status(404).json({ success: false, message: "Point not found" });
        res.status(200).json({ success: true, data: point });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// @desc    Delete SOP point
// @route   DELETE /api/sop-points/:id
exports.deletePoint = async (req, res) => {
    try {
        const point = await SopPoint.findByIdAndDelete(req.params.id);
        if (!point) return res.status(404).json({ success: false, message: "Point not found" });
        res.status(200).json({ success: true, message: "Point deleted" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// @desc    Reorder points
// @route   POST /api/sop-points/reorder
exports.reorderPoints = async (req, res) => {
    try {
        const { orders } = req.body; // Array of { id, order }
        const bulkOps = orders.map(item => ({
            updateOne: {
                filter: { _id: item.id },
                update: { order: item.order }
            }
        }));

        await SopPoint.bulkWrite(bulkOps);
        res.status(200).json({ success: true, message: "Points reordered" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

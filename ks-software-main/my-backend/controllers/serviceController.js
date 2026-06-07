const ServiceItem = require("../models/ServiceItem");

// ✅ Create
exports.createServiceItem = async (req, res) => {
    try {
        const serviceItem = await ServiceItem.create(req.body);
        res.status(201).json({ success: true, data: serviceItem });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

// ✅ Read all
exports.getAllServiceItems = async (req, res) => {
    try {
        const serviceItems = await ServiceItem.find().sort({ category: 1, name: 1 });
        res.status(200).json({ success: true, data: serviceItems });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// ✅ Read single
exports.getSingleServiceItem = async (req, res) => {
    try {
        const serviceItem = await ServiceItem.findById(req.params.id);
        if (!serviceItem) {
            return res.status(404).json({ success: false, error: "Service item not found" });
        }
        res.status(200).json({ success: true, data: serviceItem });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// ✅ Update
exports.updateServiceItem = async (req, res) => {
    try {
        const serviceItem = await ServiceItem.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true,
        });

        if (!serviceItem) {
            return res.status(404).json({ success: false, error: "Service item not found" });
        }

        res.status(200).json({ success: true, data: serviceItem });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

// ✅ Delete
exports.deleteServiceItem = async (req, res) => {
    try {
        const serviceItem = await ServiceItem.findByIdAndDelete(req.params.id);

        if (!serviceItem) {
            return res.status(404).json({ success: false, error: "Service item not found" });
        }

        res.status(200).json({ success: true, message: "Service item deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

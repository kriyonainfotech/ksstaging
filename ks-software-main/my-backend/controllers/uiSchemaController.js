const UiSchema = require("../models/UiSchema");

// @desc    Get UI Schema for a specific resource
// @route   GET /api/ui-schema/:resource
// @access  Public (or Private, depending on needs)
exports.getSchema = async (req, res) => {
    try {
        const { resource } = req.params;

        const variant = req.query.variant || 'default';

        const schema = await UiSchema.findOne({ resource, variant });

        if (!schema) {
            // Fallback: If 'design' schema doesn't exist, try loading 'default'
            const fallback = await UiSchema.findOne({ resource, variant: 'default' });
            return res.status(200).json(fallback || { fields: [] });
        }

        // Sort fields by 'order' property before sending
        schema.fields.sort((a, b) => a.order - b.order);

        return res.status(200).json({ success: true, data: schema });

    } catch (error) {
        console.error("Schema Fetch Error:", error);
        return res.status(500).json({ success: false, message: "Server error fetching schema" });
    }
};

// @desc    Create or Update Schema (The "Builder" Endpoint)
// @route   POST /api/ui-schema
// @access  Private (Admin Only)
exports.updateSchema = async (req, res) => {
    try {
        const { resource, fields } = req.body;

        if (!resource || !fields) {
            return res.status(400).json({ success: false, message: "Resource and fields are required" });
        }

        // upsert: true means "Create if it doesn't exist, Update if it does"
        const schema = await UiSchema.findOneAndUpdate(
            { resource },
            { fields },
            { new: true, upsert: true, runValidators: true }
        );

        res.status(200).json({ success: true, data: schema });
    } catch (error) {
        console.error("Schema Update Error:", error);
        res.status(500).json({ message: error.message });
    }
};
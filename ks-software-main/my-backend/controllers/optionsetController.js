const OptionSet = require("../models/OptionSet");
const mongoose = require("mongoose");

/**
 * ✅ Create Option Set
 * Example: task_status, task_priority
 */
exports.createOptionSet = async (req, res) => {
    try {
        const { name, options } = req.body;
        console.log(name, options, "------------------------------optionset");

        if (!name || !Array.isArray(options)) {
            return res.status(400).json({
                success: false,
                message: "Name and options array are required"
            });
        }

        const exists = await OptionSet.findOne({ name });
        if (exists) {
            return res.status(409).json({
                success: false,
                message: "OptionSet with this name already exists"
            });
        }

        const optionSet = await OptionSet.create({ name, options });
        console.log(optionSet);

        res.status(201).json({
            success: true,
            message: "OptionSet created successfully",
            data: optionSet
        });

    } catch (error) {
        console.log("Create OptionSet Error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};


/**
 * ✅ Get all Option Sets
 */
exports.getAllOptionSets = async (req, res) => {
    try {
        const optionSets = await OptionSet.find().sort({ name: 1 });
        console.log(optionSets, "optionSets---------------------------------------------");
        res.status(200).json({
            success: true,
            data: optionSets
        });
    } catch (error) {
        console.error("Get OptionSets Error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};


/**
 * ✅ Get Option Set by name
 * Example: /option-sets/task_status
 */
exports.getOptionSetByName = async (req, res) => {
    try {
        const { name } = req.params;

        const optionSet = await OptionSet.findOne({ name });
        if (!optionSet) {
            return res.status(404).json({
                success: false,
                message: "OptionSet not found"
            });
        }

        res.status(200).json({
            success: true,
            data: optionSet
        });
    } catch (error) {
        console.error("Get OptionSet Error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};


/**
 * ✅ Add new option (NON-SYSTEM only)
 */
exports.addOption = async (req, res) => {
    try {
        const { optionSetId } = req.params;
        const { label, value, color } = req.body;

        if (!mongoose.Types.ObjectId.isValid(optionSetId)) {
            return res.status(400).json({ success: false, message: "Invalid OptionSet ID" });
        }

        const optionSet = await OptionSet.findById(optionSetId);
        if (!optionSet) {
            return res.status(404).json({ success: false, message: "OptionSet not found" });
        }

        optionSet.options.push({
            label,
            value,
            color,
            isSystem: false
        });

        await optionSet.save();

        res.status(200).json({
            success: true,
            message: "Option added successfully",
            data: optionSet
        });

    } catch (error) {
        console.error("Add Option Error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};


/**
 * ✅ Update option (BLOCK system options)
 */
exports.updateOption = async (req, res) => {
    try {
        const { optionSetId, optionId } = req.params;
        const { label, value, color } = req.body;

        const optionSet = await OptionSet.findById(optionSetId);
        if (!optionSet) {
            return res.status(404).json({ success: false, message: "OptionSet not found" });
        }

        const option = optionSet.options.id(optionId);
        if (!option) {
            return res.status(404).json({ success: false, message: "Option not found" });
        }

        if (option.isSystem) {
            return res.status(403).json({
                success: false,
                message: "System options cannot be modified"
            });
        }

        option.label = label ?? option.label;
        option.value = value ?? option.value;
        option.color = color ?? option.color;

        await optionSet.save();

        res.status(200).json({
            success: true,
            message: "Option updated successfully",
            data: optionSet
        });

    } catch (error) {
        console.error("Update Option Error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};


/**
 * ✅ Delete option (BLOCK system options)
 */
exports.deleteOption = async (req, res) => {
    try {
        const { optionSetId, optionId } = req.params;

        const optionSet = await OptionSet.findById(optionSetId);
        if (!optionSet) {
            return res.status(404).json({ success: false, message: "OptionSet not found" });
        }

        const option = optionSet.options.id(optionId);
        if (!option) {
            return res.status(404).json({ success: false, message: "Option not found" });
        }

        if (option.isSystem) {
            return res.status(403).json({
                success: false,
                message: "System options cannot be deleted"
            });
        }

        optionSet.options.pull(optionId);
        await optionSet.save();

        res.status(200).json({
            success: true,
            message: "Option deleted successfully"
        });

    } catch (error) {
        console.error("Delete Option Error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

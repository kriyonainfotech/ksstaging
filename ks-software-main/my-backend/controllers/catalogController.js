const ServiceItem = require("../models/ServiceItem");
const PackageTemplate = require("../models/PackageTemplate");
const mongoose = require("mongoose");

// -------------------------------------------------------
// 🌐 LOGGER UTILS
// -------------------------------------------------------
const logInfo = (msg, data = {}) => {
    console.log(`[CATALOG][INFO]: ${msg}`, JSON.stringify(data, null, 2));
};

const logError = (msg, error = {}) => {
    console.error(`[CATALOG][ERROR]: ${msg}`, error);
};

// Helper for ID Validation
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// =======================================================
// 1. SERVICE ITEM CONTROLLERS
// =======================================================

// GET ALL SERVICES
exports.getServices = async (req, res) => {
    logInfo("Fetching all services initiated", {
        user: req.user ? req.user.id : "Unknown"
    });

    try {
        const services = await ServiceItem
            .find({ status: "active" })
            .sort({ createdAt: -1 });

        logInfo("Services fetched successfully", { count: services.length });

        return res.status(200).json({
            success: true,
            count: services.length,
            data: services
        });
    } catch (error) {
        logError("Failed to fetch services", error.message);
        return res.status(500).json({
            success: false,
            error: "Internal Server Error"
        });
    }
};

// CREATE SERVICE
exports.createService = async (req, res) => {
    logInfo("Creating new service initiated", req.body);

    try {
        const service = await ServiceItem.create(req.body);

        logInfo("Service created successfully", {
            id: service._id,
            name: service.name
        });

        return res.status(201).json({
            success: true,
            data: service
        });
    } catch (error) {
        logError("Failed to create service", error.message);
        return res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

// UPDATE SERVICE
exports.updateService = async (req, res) => {
    const { id } = req.params;
    logInfo("Updating service initiated", { id, updates: req.body });

    if (!isValidId(id)) {
        logError("Invalid Service ID format", { id });
        return res.status(400).json({
            success: false,
            error: "Invalid Service ID"
        });
    }

    try {
        const existingService = await ServiceItem.findById(id);
        if (!existingService) {
            logError("Service not found for update", { id });
            return res.status(404).json({
                success: false,
                error: "Service not found"
            });
        }

        const service = await ServiceItem.findByIdAndUpdate(
            id,
            req.body,
            { new: true, runValidators: true }
        );

        logInfo("Service updated successfully", { id: service._id });

        return res.status(200).json({
            success: true,
            data: service
        });
    } catch (error) {
        logError("Failed to update service", error.message);
        return res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

// SOFT DELETE SERVICE
exports.deleteService = async (req, res) => {
    const { id } = req.params;
    logInfo("Archiving service initiated", { id });

    if (!isValidId(id)) {
        logError("Invalid Service ID format", { id });
        return res.status(400).json({
            success: false,
            error: "Invalid Service ID"
        });
    }

    try {
        const service = await ServiceItem.findById(id);
        if (!service) {
            logError("Service not found for deletion", { id });
            return res.status(404).json({
                success: false,
                error: "Service not found"
            });
        }

        if (service.status === "archived") {
            return res.status(200).json({
                success: true,
                message: "Service already archived"
            });
        }

        service.status = "archived";
        await service.save();

        logInfo("Service archived successfully", { id });

        return res.status(200).json({
            success: true,
            message: "Service archived successfully"
        });
    } catch (error) {
        logError("Failed to archive service", error.message);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};


// =======================================================
// 2. PACKAGE TEMPLATE CONTROLLERS
// =======================================================

// GET ALL PACKAGES
exports.getPackages = async (req, res) => {
    logInfo("Fetching all packages initiated", {
        user: req.user ? req.user.id : "Unknown"
    });

    try {
        const packages = await PackageTemplate
            .find({ status: "active" })
            .populate("lineItems.item")
            .sort({ createdAt: -1 });

        console.log(packages, "packages");
        logInfo("Packages fetched successfully", {
            count: packages.length
        });

        return res.status(200).json({
            success: true,
            count: packages.length,
            data: packages
        });
    } catch (error) {
        logError("Failed to fetch packages", error.message);
        return res.status(500).json({
            success: false,
            error: "Internal Server Error"
        });
    }
};

// CREATE PACKAGE
exports.createPackage = async (req, res) => {
    logInfo("Creating package initiated", req.body);

    try {
        const pkg = await PackageTemplate.create(req.body);
        const populatedPkg = await pkg.populate("lineItems.item");

        logInfo("Package created successfully", {
            id: pkg._id,
            name: pkg.packageName
        });

        return res.status(201).json({
            success: true,
            data: populatedPkg
        });
    } catch (error) {
        logError("Failed to create package", error.message);
        return res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

// UPDATE PACKAGE
exports.updatePackage = async (req, res) => {
    const { id } = req.params;
    logInfo("Updating package initiated", { id, updates: req.body });

    if (!isValidId(id)) {
        logError("Invalid Package ID format", { id });
        return res.status(400).json({
            success: false,
            error: "Invalid Package ID"
        });
    }

    try {
        const existingPkg = await PackageTemplate.findById(id);
        if (!existingPkg) {
            logError("Package not found for update", { id });
            return res.status(404).json({
                success: false,
                error: "Package not found"
            });
        }

        const pkg = await PackageTemplate.findByIdAndUpdate(
            id,
            req.body,
            { new: true, runValidators: true }
        ).populate("lineItems.item");

        logInfo("Package updated successfully", { id: pkg._id });

        return res.status(200).json({
            success: true,
            data: pkg
        });
    } catch (error) {
        logError("Failed to update package", error.message);
        return res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

// ARCHIVE PACKAGE (SOFT DELETE)
// ARCHIVE PACKAGE (SOFT DELETE USING STATUS)
exports.deletePackage = async (req, res) => {
    const { id } = req.params;
    logInfo("Archiving package initiated", { id });

    if (!isValidId(id)) {
        logError("Invalid Package ID format", { id });
        return res.status(400).json({
            success: false,
            message: "Invalid Package ID",
        });
    }

    try {
        const pkg = await PackageTemplate.findById(id);

        if (!pkg) {
            logError("Package not found for deletion", { id });
            return res.status(404).json({
                success: false,
                message: "Package not found",
            });
        }

        // Already archived
        if (pkg.status === "archived") {
            return res.status(200).json({
                success: true,
                message: "Package already archived",
            });
        }

        // Soft delete
        pkg.status = "archived";
        await pkg.save();

        logInfo("Package archived successfully", { id });

        return res.status(200).json({
            success: true,
            message: "Package archived successfully",
        });

    } catch (error) {
        logError("Failed to archive package", { error: error.message });

        return res.status(500).json({
            success: false,
            message: "Failed to archive package",
            error: error.message,
        });
    }
};


const jwt = require("jsonwebtoken");
const User = require("../models/user");
const ROLE_PERMISSIONS = require("../config/roleDefaults");

exports.IsAdmin = (req, res, next) => {
    try {
        // Get token from Authorization header or cookies
        let token = null;
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
            token = req.headers.authorization.split(' ')[1];
        } else if (req.cookies && req.cookies.token) {
            token = req.cookies.token;
        }

        if (!token) {
            return res.status(401).json({ message: 'No token provided' });
        }

        // Decode token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Check if user is admin or superadmin
        if (decoded.role !== 'Admin' && decoded.role !== 'Superadmin') {
            return res.status(403).json({ message: 'Access denied: Admins only' });
        }

        // Attach user to request
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
};

// 1. Protect routes (Login Required)
exports.protect = async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith("Bearer")
    ) {
        token = req.headers.authorization.split(" ")[1];
    }

    if (token === "null" || token === "undefined") {
        token = null;
    }

    if (!token && req.cookies?.token) {
        token = req.cookies.token;
    }


    if (!token) {
        return res.status(401).json({ message: "Not authorized, token missing" });
    }


    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Fetch user from User collection
        let user = await User.findById(decoded.id).select("-password").populate("company", "name").populate("accessibleCompanies", "name");

        // --- RESOLVE MULTI-COMPANY CONTEXT ---
        const headerCompanyId = req.headers["x-company-id"];
        const Company = require("../models/Company");

        if (headerCompanyId && headerCompanyId !== "null") {
            const hasAccess = user.role === "Superadmin" ||
                user.company?.toString() === headerCompanyId ||
                user.accessibleCompanies.some(c => c._id.toString() === headerCompanyId);

            if (hasAccess) {
                const activeComp = await Company.findById(headerCompanyId);
                user.activeCompany = headerCompanyId;
                user.activeCompanyName = activeComp ? activeComp.name : null;
            } else {
                return res.status(403).json({ success: false, error: "Access denied to this company context" });
            }
        } else {
            // Default to their primary company
            user.activeCompany = user.company;
            // If primary company is populated, get the name
            if (user.company && typeof user.company === 'object') {
                user.activeCompanyName = user.company.name;
            } else if (user.company) {
                const primaryComp = await Company.findById(user.company);
                user.activeCompanyName = primaryComp ? primaryComp.name : null;
            }
        }

        req.user = user;

        // Double Check: If user was deleted or suspended while token is still valid
        if (!req.user || req.user.isActive === false) {
            return res.status(401).json({ success: false, error: "User not found or suspended" });
        }

        next(); // Move to the actual controller
    } catch (err) {
        console.error(err);
        return res.status(401).json({ success: false, error: "Not authorized to access this route" });
    }
};

// 2. Grant access to specific roles (RBAC)
exports.authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: `User role '${req.user.role}' is not authorized to access this route`,
            });
        }
        next();
    };
};

// middleware/authMiddleware.js
exports.hasPermission = (requiredPermission) => {
    return (req, res, next) => {
        // req.user is attached by protect middleware
        if (!req.user) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }

        // 1. SUPERADMIN & ADMIN = Elevated Access
        if (req.user.role === "Superadmin" || req.user.role === "Admin") {
            return next();
        }

        // 2. Merge role defaults with user-specific permissions.
        // This keeps older users functional even if their stored customPermissions missed a default.
        const rolePermissions = ROLE_PERMISSIONS[req.user.role] || [];
        const userPermissions = [
            ...new Set([
                ...rolePermissions,
                ...(req.user.customPermissions || [])
            ])
        ];

        // 3. Check if the user has required permission
        if (!userPermissions.includes(requiredPermission)) {
            return res.status(403).json({
                success: false,
                error: `Access Denied: '${requiredPermission}' permission required.`,
            });
        }

        next();
    };
};

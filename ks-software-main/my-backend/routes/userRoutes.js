const express = require("express");
const { protect, authorize } = require("../middleware/authMiddleware");
const { getAdmins, createAdmin, deleteAdmin, updateAdmin, updateAdminStatus, getAdminById,
   createTeam, getTeams, deleteTeam, updateTeam, updateTeamStatus, getTeamById,
   resetPassword,
   createClient,
   getAllClients,
   deleteClient,
   getClientDeletionPreview,
   updateClient,
   getClientById,
   getClientsByTeamMember,
   getSuperAdmins,
   createSuperAdmin,
   updateUserPermissions,
   addUserAccessibleCompany } = require("../controllers/userController");
const { getMyWalletStats, getTeamSalaryOverview } = require("../controllers/salaryController");
const upload = require("../middleware/upload");

const router = express.Router();

router.use((req, res, next) => {
   console.log("👉 userRoutes hit:", req.method, req.url);
   next();
});

// Middlewares for all user routes
router.use(protect);

/* --------------------
   ADMIN MANAGEMENT
   Only Superadmin can do these
--------------------- */
router.get("/superadmin/all", authorize("Superadmin"), getSuperAdmins);
router.post("/superadmin/create", authorize("Superadmin"), createSuperAdmin);
router.post("/admin/create", authorize("Superadmin", "Admin"), createAdmin);
router.get("/admin/all", authorize("Superadmin", "Admin"), getAdmins);
router.delete("/admin/delete", authorize("Superadmin", "Admin"), deleteAdmin);
router.put("/admin/update/:id", authorize("Superadmin", "Admin"), updateAdmin);
router.put("/admin/permissions/:id", authorize("Superadmin", "Admin"), updateUserPermissions);
router.put("/admin/accessible-companies/:id", authorize("Superadmin"), addUserAccessibleCompany);
router.put("/admin/updateStatus", authorize("Superadmin", "Admin"), updateAdminStatus);
router.post("/admin/ById", authorize("Superadmin", "Admin"), getAdminById);
router.put("/admin/resetPassword/:id", authorize("Superadmin"), resetPassword);

/* --------------------
   TEAM MANAGEMENT
   Superadmin + Admin BOTH can do these
--------------------- */
// router.post("/team/create", authorize("Superadmin", "Admin"), createTeam);

router.post(
   "/team/create",
   protect,
   authorize("Superadmin", "Admin"),
   upload.single("profilePic"),
   createTeam
);

router.get("/team/all", authorize("Superadmin", "Admin"), getTeams);
router.delete("/team/delete/:id", authorize("Superadmin", "Admin"), deleteTeam);

router.put(
   "/team/update/:id",
   protect,
   authorize("Superadmin", "Admin", "Team"),
   upload.single("profilePic"),
   updateTeam
);

router.put("/team/updateStatus", authorize("Superadmin", "Admin"), updateTeamStatus);
router.post("/team/ById", authorize("Superadmin", "Admin", "Team"), getTeamById);
router.put("/team/resetPassword/:id", authorize("Superadmin", "Admin"), resetPassword);
// router.post("/team/get-password", protect, authorize("Superadmin");

/* ---------------------
   CLIENT MANAGEMENT
   Superadmin + Admin BOTH can do these
--------------------- */
router.post("/client/create", authorize("Superadmin", "Admin"), createClient);
router.get("/client/all", authorize("Superadmin", "Admin"), getAllClients);
router.get("/client/:id/deletion-preview", authorize("Superadmin", "Admin"), getClientDeletionPreview);
router.delete("/client/delete/:id", authorize("Superadmin", "Admin"), deleteClient);
router.put("/client/update/:id", authorize("Superadmin", "Admin"), updateClient);
router.post("/client/ById", authorize("Superadmin", "Admin"), getClientById);
router.get("/client/team/:teamId", authorize("Superadmin", "Admin", "Team"), getClientsByTeamMember);
router.put('/client/resetPassword/:id', authorize("Superadmin", "Admin"), resetPassword);

/* ---------------------
   SALARY & WALLET
--------------------- */
router.get("/salary/wallet", getMyWalletStats);
router.get("/salary/admin/overview", authorize("Superadmin", "Admin"), getTeamSalaryOverview);

module.exports = router;

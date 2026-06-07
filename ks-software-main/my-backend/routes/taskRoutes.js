const express = require('express');
const router = express.Router();
const {
    createTask,
    deleteTask,
    getTasks,
    updateTaskStatus,
    getTasksByTeamMember,
    updateTask
} = require('../controllers/taskController');

const { hasPermission, protect } = require('../middleware/authMiddleware');
router.use(protect);

// 1. Get Tasks (Controller handles "My Tasks" vs "All Tasks" logic)
router.get("/get-tasks", hasPermission("task.view_all"), getTasks);

// 1.1 Get Tasks by Team Member
router.get("/team-member/:id", hasPermission("task.view"), getTasksByTeamMember);

// 2. Create Task
router.post("/create-task", hasPermission("task.manage"), createTask);

// 3. Update Status (Pending -> Done -> Posted)
router.put("/update-status/:id", hasPermission("task.manage"), updateTaskStatus);

// 4. Update Generic Task Details
router.put("/update-task/:id", hasPermission("task.manage"), updateTask);

// 5. Delete Task (SA/Admin only)
router.delete("/delete-task/:id", hasPermission("task.delete"), deleteTask);



module.exports = router;

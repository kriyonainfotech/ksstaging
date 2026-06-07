const ROLE_PERMISSIONS = {
    // 1. Superadmin (Access to Everything)
    Superadmin: [
        "admin.manage", "team.manage", "client.manage",
        "attendance.view", "attendance.manage",
        "payroll.view", "payroll.manage",
        "task.view", "task.view_all", "task.manage",
        "service.manage", "lead.manage", "client.view",
        "payment.view", "payment.manage",
        "schedule.view", "schedule.manage",
        "sop.view", "sop.manage",
        "notification.manage",
        "company.edit", "access.control"
    ],

    // 2. Admin (Company Owner / Manager)
    Admin: [
        "team.manage", "client.manage",
        "attendance.view", "attendance.manage",
        "payroll.view",
        "task.view", "task.view_all", "task.manage",
        "service.manage", "lead.manage", "client.view",
        "payment.view", "payment.manage",
        "schedule.view", "schedule.manage",
        "sop.view",
        "notification.manage",
        "company.edit"
    ],

    // 3. Team Member (Employee)
    Team: [
        "attendance.view",
        "payroll.view",
        "task.view",
        "task.manage",
        "sop.view"
    ],

    // 4. Client
    Client: [
        "task.view",
        "payment.view",
        "schedule.view"
    ],

    // 5. Basic User
    User: []
};

module.exports = ROLE_PERMISSIONS;
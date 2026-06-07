const mongoose = require("mongoose");

const scheduleSchema = new mongoose.Schema(
  {
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClientProfile", // Changed to ClientProfile to match Task.js
      required: true,
    },
    subscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClientSubscription",
    },
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServiceItem", // Changed to ServiceItem to match subscriptions
    },
    date: {
      type: Date,
      // Optional for unscheduled quota items
    },
    postType: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      trim: true,
      default: "",
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["Unscheduled", "Scheduled", "Completed", "Cancelled"],
      default: "Unscheduled",
    },
    // The task linked to this schedule item
    linkedTask: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task"
    },
    // --- CHUTAK FIELDS ---
    price: {
      type: Number,
      default: 0
    },
    isChutak: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

// --- SYNC HOOK ---
// When a schedule item is saved, if it has a linkedTask, we sync metadata back to the Task
scheduleSchema.post("save", async function (doc) {
  // 1. Sync back to Task if exists
  if (doc.linkedTask) {
    try {
      const Task = mongoose.model("Task");
      const existingTask = await Task.findById(doc.linkedTask).populate("assignedTo");
      let targetStatus = doc.status === "Completed" ? "Done" : "Pending";
      if (existingTask && existingTask.assignedTo) {
          const spec = (existingTask.assignedTo.profile?.specialization || existingTask.assignedTo.specialization || "").toLowerCase().trim();
          if (spec.includes("web") || spec.includes("dev") || spec.includes("software")) {
              targetStatus = doc.status === "Completed" ? "DONE" : "PENDING";
          }
      }
      const updateData = {
        title: doc.content,
        description: doc.description,
        dueDate: doc.date,
        status: targetStatus
      };
      await Task.findByIdAndUpdate(doc.linkedTask, updateData);
    } catch (error) {
      console.error("[SYNC][SCHEDULE -> TASK] Error:", error);
    }
  }

  // 2. Check if the entire subscription is now completed
  if (doc.subscription && (doc.status === "Completed" || doc.status === "Cancelled")) {
    try {
      const remaining = await mongoose.model("Schedule").countDocuments({
        subscription: doc.subscription,
        status: { $nin: ["Completed", "Cancelled"] }
      });

      if (remaining === 0) {
        const ClientSubscription = mongoose.model("ClientSubscription");
        await ClientSubscription.findByIdAndUpdate(doc.subscription, { status: "Completed" });
        console.log(`[SUBSCRIPTION][AUTO-COMPLETE] Package ${doc.subscription} marked as COMPLETED via Schedule`);
      }
    } catch (error) {
      console.error("[SYNC][SCHEDULE -> SUBSCRIPTION] Error:", error);
    }
  }
});

module.exports = mongoose.model("Schedule", scheduleSchema);

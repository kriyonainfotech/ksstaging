const mongoose = require('mongoose');
const { startOfDay, endOfDay, addDays } = require('date-fns');

const MONGO_URI = "mongodb+srv://kriyonastudio_db:kriyonastudio_db@cluster0.ebnasrj.mongodb.net/ks-adminpanel?retryWrites=true&w=majority&appName=Cluster0";

async function checkTasks() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("Connected to MongoDB");

        const Task = mongoose.model('Task', new mongoose.Schema({
            title: String,
            dueDate: Date,
            type: String,
            scheduleItem: mongoose.Schema.Types.ObjectId,
            assignedTo: mongoose.Schema.Types.ObjectId,
            assignedModel: String,
            status: String
        }));

        const tomorrow = startOfDay(addDays(new Date(), 1));
        const tomorrowEnd = endOfDay(tomorrow);

        const specificTask = await Task.findById("69bff1f276c4eb6a409a03aa");
        if (specificTask) {
            console.log(`SPECIFIC TASK FOUND: [${specificTask.title}]`);
            console.log(`  - Status: ${specificTask.status}`);
            console.log(`  - scheduleItem: ${specificTask.scheduleItem || "MISSING"}`);
            console.log(`  - dueDate: ${specificTask.dueDate.toISOString()}`);
            console.log(`  - type: ${specificTask.type}`);
        } else {
            console.log("SPECIFIC TASK NOT FOUND: 69bff1f276c4eb6a409a03aa");
        }
        console.log('---');

        console.log(`Checking tasks for: ${tomorrow.toISOString()} to ${tomorrowEnd.toISOString()}`);

        const tasks = await Task.find({
            dueDate: { $gte: tomorrow, $lte: tomorrowEnd },
            type: "Team"
        });

        console.log(`Found ${tasks.length} Team tasks for tomorrow.`);

        tasks.forEach(task => {
            console.log(`Task: [${task.title}]`);
            console.log(`  - Status: ${task.status}`);
            console.log(`  - scheduleItem: ${task.scheduleItem || "MISSING"}`);
            console.log(`  - assignedTo: ${task.assignedTo}`);
            console.log(`  - assignedModel: ${task.assignedModel}`);
            console.log(`  - dueDate: ${task.dueDate.toISOString()}`);
            console.log('---');
        });

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkTasks();

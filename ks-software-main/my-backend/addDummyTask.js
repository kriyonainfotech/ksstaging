const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/user');
const Task = require('./models/Task');

// Load env
dotenv.config();

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('MongoDB Connected...');
    } catch (err) {
        console.error('Error connecting to MongoDB:', err.message);
        process.exit(1);
    }
};

const addDummyTask = async () => {
    await connectDB();
    try {
        // Find user with name containing "dummy"
        let dummyUser = await User.findOne({ name: { $regex: /dummy/i } });
        
        if (!dummyUser) {
            console.log('No user found with "dummy" in their name. Creating one now...');
            dummyUser = new User({
                name: "Dummy User",
                email: "dummy@example.com",
                password: "password123",
                role: "Team"
            });
            await dummyUser.save();
            
            // Also create a TeamProfile for this dummy user (Video Editor)
            const TeamProfile = require('./models/TeamProfile');
            await TeamProfile.create({
                user: dummyUser._id,
                specialization: "video"
            });
            console.log('Created dummy Team member (Video Editor).');
        }
        
        console.log(`Found dummy user: ${dummyUser.name} (${dummyUser._id})`);
        
        // Find an admin or superadmin to be the creator
        const adminUser = await User.findOne({ role: { $in: ['Superadmin', 'Admin'] } });
        
        if (!adminUser) {
            console.log('No Admin/Superadmin found to create the task.');
            process.exit(0);
        }

        const newTask = new Task({
            title: "Dummy Task For Testing",
            description: "This is a dummy task created by a script.",
            type: "Team",
            status: "Pending",
            dueDate: new Date(),
            assignedTo: dummyUser._id,
            assignedModel: 'User', // Actually based on schema it's User, Admin, Team. Let's use User.
            createdBy: adminUser._id,
            creatorModel: 'User'
        });

        await newTask.save();
        console.log(`Successfully added dummy task: ${newTask._id} for user ${dummyUser.name}`);
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
};

addDummyTask();

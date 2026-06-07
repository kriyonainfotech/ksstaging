const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const User = require("./models/user");
const Team = require("./models/Team");

async function verifyFix() {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        // Simulating the controller logic
        const teamMembers = await Team.find();
        const legacyTeamMembers = await User.find({ role: "Team" });

        console.log("FROM_TEAM_COLLECTION:");
        teamMembers.forEach(m => console.log(`${m.email} | ${m.role}`));

        console.log("FROM_USER_COLLECTION (role=Team):");
        legacyTeamMembers.forEach(m => console.log(`${m.email} | ${m.role}`));

        const teamMap = new Map();
        teamMembers.forEach(m => teamMap.set(m.email.toLowerCase(), m));
        legacyTeamMembers.forEach(m => {
            if (!teamMap.has(m.email.toLowerCase())) {
                teamMap.set(m.email.toLowerCase(), m);
            }
        });

        console.log(`TOTAL_UNIFIED: ${teamMap.size}`);

        process.exit(0);
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
}

verifyFix();

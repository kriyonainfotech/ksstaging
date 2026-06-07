const admin = require("firebase-admin");
const path = require("path");

const serviceAccount = require(path.join(__dirname, "firebase-service-account.json")); 
// Make sure this file exists in /config

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });

    console.log("🔥 Firebase Admin Initialized");
}

module.exports = admin;

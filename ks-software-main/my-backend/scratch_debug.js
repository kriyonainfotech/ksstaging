const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const PaymentSale = require("./models/PaymentSale");
const PaymentCollection = require("./models/PaymentCollection");

async function checkISTStats() {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        // Current date in India is May 21, 2026
        const now = new Date("2026-05-21T12:00:00+05:30");

        // Calculate IST month start and end
        // May 1st 00:00:00 IST -> UTC is April 30th 18:30:00
        const monthStartIST = new Date(Date.UTC(2026, 4, 30, 18, 30, 0, 0));
        // May 31st 23:59:59.999 IST -> UTC is May 31st 18:29:59.999
        const monthEndIST = new Date(Date.UTC(2026, 5, 31, 18, 29, 59, 999));

        console.log("IST Month Start (UTC):", monthStartIST.toISOString());
        console.log("IST Month End (UTC):", monthEndIST.toISOString());

        // 1. May Sales in IST
        const sales = await PaymentSale.find({
            saleDate: { $gte: monthStartIST, $lte: monthEndIST }
        });
        
        let maySalesTotal = 0;
        let maySalesOutstanding = 0;
        let maySalesCollected = 0;
        sales.forEach(s => {
            maySalesTotal += s.totalAmount;
            if (s.remainingAmount > 0) {
                maySalesOutstanding += s.remainingAmount;
            }
            maySalesCollected += s.collectedAmount || 0;
        });

        console.log("\n--- May Sales Stats (IST) ---");
        console.log("May Sales:", maySalesTotal);
        console.log("May Sales Collected (May Collection):", maySalesCollected);
        console.log("May Sales Outstanding:", maySalesOutstanding);

        // 2. May Collections in IST (by transaction type Income)
        const collections = await PaymentCollection.find({
            transactionType: "Income",
            collectionDate: { $gte: monthStartIST, $lte: monthEndIST }
        });
        let mayCollectionsTotal = 0;
        collections.forEach(c => {
            mayCollectionsTotal += c.amountCollected;
        });
        console.log("May Collections (Income transactions in May):", mayCollectionsTotal);

        // 3. Total Outstanding in IST (all time)
        const outstandingSalesAllTime = await PaymentSale.find({
            remainingAmount: { $gt: 0 }
        });
        let totalOutstanding = 0;
        outstandingSalesAllTime.forEach(s => {
            totalOutstanding += s.remainingAmount;
        });
        console.log("Total Outstanding (All time):", totalOutstanding);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkISTStats();

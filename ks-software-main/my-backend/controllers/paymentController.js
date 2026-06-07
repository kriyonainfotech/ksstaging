const PaymentSale = require("../models/PaymentSale");
const PaymentCollection = require("../models/PaymentCollection");
const Client = require("../models/Client");
const Company = require("../models/Company");

// Helper: Check if user belongs to the target company
const validateCompanyAccess = async (user, targetCompanyName) => {
    // 1. Master Admin Bypass
    if (user.email === "yogeshnarola@kriyonastudio.com") return true;

    // 2. Check if user has a company assigned
    if (!user.company) return false;

    // 3. Find the ID of the target company name
    const targetCompany = await Company.findOne({ name: targetCompanyName });
    if (!targetCompany) return false;

    // 4. Compare IDs
    return targetCompany._id.equals(user.company) || targetCompany.admins.includes(user._id);
};

/**
 * 1. Create a New Sale (Invoice)
 */
exports.createSale = async (req, res) => {
    console.log("[create payment][INFO] API HIT");

    try {
        const {
            clientId,
            guestName,
            guestPhone,
            title,
            totalAmount,
            saleDate,
            notes,
            company,
            destinationAccount
        } = req.body;

        console.log("[create payment][INFO] Payload:", req.body);

        // --- OWNERSHIP CHECK (Updated for Dynamic Companies) ---
        const hasAccess = await validateCompanyAccess(req.user, company);

        if (!hasAccess) {
            console.warn("[create payment][WARN] Unauthorized company:", company, "for user:", req.user.email);
            return res.status(403).json({
                success: false,
                message: `You are not authorized to create sales for ${company}`
            });
        }

        // Validation
        if (!clientId && !guestName) {
            console.warn("[create payment][WARN] Missing client or guest");
            return res.status(400).json({
                success: false,
                message: "Please select a Client OR enter a Guest Name."
            });
        }

        if (!title || !totalAmount || !company) {
            console.warn("[create payment][WARN] Missing title, amount, or company");
            return res.status(400).json({
                success: false,
                message: "Title, Total Amount, and Company are required"
            });
        }

        const newSale = await PaymentSale.create({
            createdBy: req.user.id,
            client: clientId || null,
            isGuest: !clientId,
            guestName: clientId ? null : guestName,
            guestPhone: clientId ? null : guestPhone,
            title,
            totalAmount: Number(totalAmount),
            saleDate: saleDate || new Date(),
            notes,
            company,
            destinationAccount: destinationAccount || "Company Bank"
        });

        console.log("[create payment][SUCCESS] Sale Created:", newSale._id);

        res.status(201).json({ success: true, data: newSale });
    } catch (error) {
        console.error("[create payment][ERROR]", error);
        res.status(500).json({
            success: false,
            message: "Failed to create sale",
            error: error.message
        });
    }
};

/**
 * 2. Collect Payment
 */
exports.collectPayment = async (req, res) => {
    console.log("[collect payment][INFO] API HIT");

    try {
        const {
            saleId,
            amountCollected,
            amountLoss,
            paymentMode,
            destinationAccount,
            date,
            notes
        } = req.body;

        console.log("[collect payment][INFO] Payload:", req.body);

        const sale = await PaymentSale.findById(saleId).populate("client");

        if (!sale) {
            console.warn("[collect payment][WARN] Sale not found:", saleId);
            return res.status(404).json({ success: false, message: "Sale not found" });
        }

        // Permission Check: Global Admin OR Creator OR Company Owner
        // Permission Check: Global Admin OR Creator OR Company Owner
        const isGlobalAdmin = req.user.role === "Superadmin" || req.user.email === "yogeshnarola@kriyonastudio.com";
        const isCreator = sale.createdBy.toString() === req.user.id;
        const isCompanyOwner = await validateCompanyAccess(req.user, sale.company);

        if (!isGlobalAdmin && !isCreator && !isCompanyOwner) {
            console.warn("[collect payment][WARN] Unauthorized attempt");
            return res.status(403).json({
                success: false,
                message: "Access Denied: You do not have permission to collect on this sale."
            });
        }

        const payerName = sale.isGuest
            ? sale.guestName
            : (sale.client?.businessName || "Unknown Client");

        const collected = Number(amountCollected) || 0;
        const loss = Number(amountLoss) || 0;

        const transaction = await PaymentCollection.create({
            createdBy: req.user.id,
            transactionType: "Income",
            saleId,
            company: sale.company, // Inherit company from sale
            payerName,
            amountCollected: collected,
            amountLoss: loss,
            paymentMode,
            destinationAccount,
            collectionDate: date || new Date(),
            notes
        });

        sale.collectedAmount += collected;
        sale.lossAmount += loss;

        await sale.save();

        console.log("[collect payment][SUCCESS] Payment Collected:", transaction._id);

        res.status(200).json({
            success: true,
            data: transaction,
            updatedSale: sale
        });
    } catch (error) {
        console.error("[collect payment][ERROR]", error);
        res.status(500).json({
            success: false,
            message: "Failed to collect payment",
            error: error.message
        });
    }
};

/**
 * 3. Get All Sales
 */
exports.getSales = async (req, res) => {
    console.log("[get sales][INFO] API HIT");

    try {
        let { company, month, year } = req.query;
        
        // --- MULTI-COMPANY CONTEXT FALLBACK ---
        if (!company || company === "All Companies") {
            company = req.user.activeCompanyName;
        }

        let query = {};

        const isGlobalAdmin = req.user.role === "Superadmin" || req.user.email === "yogeshnarola@kriyonastudio.com";
        const isAdmin = req.user.role === "Superadmin" || req.user.role === "Admin";

        if (isGlobalAdmin) {
            if (company && company !== "All Companies") {
                query.company = company;
            }
        } else if (isAdmin) {
            // Check if they have access to this company
            const hasAccess = req.user.company?.name === company || 
                              req.user.accessibleCompanies?.some(c => c.name === company);
            
            if (hasAccess) {
                query.company = company;
            } else {
                query.company = req.user.activeCompanyName;
            }
        } else {
            // Regular User: Only their own records
            query.createdBy = req.user.id;
            if (company && company !== "All Companies") {
                query.company = company;
            }
        }

        // Date Filtering
        if (month && year) {
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0, 23, 59, 59);
            query.saleDate = { $gte: startDate, $lte: endDate };
        }

        const sales = await PaymentSale.find(query)
            .populate("client", "businessName")
            .sort({ saleDate: -1 });

        console.log("[get sales][SUCCESS] Count:", sales.length);

        res.status(200).json({ success: true, data: sales });
    } catch (error) {
        console.error("[get sales][ERROR]", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch sales",
            error: error.message
        });
    }
};

/**
 * 4. Get Audit Trail
 */
exports.getCollections = async (req, res) => {
    console.log("[get collections][INFO] API HIT");

    try {
        let { company, month, year } = req.query;

        // --- MULTI-COMPANY CONTEXT FALLBACK ---
        if (!company || company === "All Companies") {
            company = req.user.activeCompanyName;
        }

        let query = {};

        const isGlobalAdmin = req.user.role === "Superadmin" || req.user.email === "yogeshnarola@kriyonastudio.com";
        const isAdmin = req.user.role === "Superadmin" || req.user.role === "Admin";

        if (isGlobalAdmin) {
            if (company && company !== "All Companies") {
                query.company = company;
            }
        } else if (isAdmin) {
            // Check if they have access to this company
            const hasAccess = req.user.company?.name === company || 
                              req.user.accessibleCompanies?.some(c => c.name === company);
            
            if (hasAccess) {
                query.company = company;
            } else {
                query.company = req.user.activeCompanyName;
            }
        } else {
            query.createdBy = req.user.id;
            if (company && company !== "All Companies") {
                query.company = company;
            }
        }

        // Date Filtering
        if (month && year) {
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0, 23, 59, 59);
            query.collectionDate = { $gte: startDate, $lte: endDate };
        }

        const history = await PaymentCollection.find(query)
            .populate("saleId", "title")
            .sort({ collectionDate: -1 });

        console.log("[get collections][SUCCESS] Count:", history.length);

        res.status(200).json({ success: true, data: history });
    } catch (error) {
        console.error("[get collections][ERROR]", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch collections",
            error: error.message
        });
    }
};

/**
 * 5. Record a General Expense
 */
exports.recordExpense = async (req, res) => {
    console.log("[record expense][INFO] API HIT");

    try {
        const {
            partyName,
            amountPaid,
            paymentMode,
            destinationAccount,
            date,
            notes,
            company,
            expenseCategory
        } = req.body;

        // --- OWNERSHIP CHECK ---
        const hasAccess = await validateCompanyAccess(req.user, company);

        if (!hasAccess) {
            return res.status(403).json({
                success: false,
                message: `You are not authorized to create expenses for ${company}`
            });
        }

        if (!partyName || !amountPaid || !company) {
            console.warn("[record expense][WARN] Missing fields");
            return res.status(400).json({
                success: false,
                message: "Party name, amount, and company are required"
            });
        }

        const expense = await PaymentCollection.create({
            createdBy: req.user.id,
            transactionType: "Expense",
            payerName: partyName,
            amountCollected: Number(amountPaid),
            amountLoss: 0,
            paymentMode,
            company,
            expenseCategory: expenseCategory || "Operational",
            destinationAccount: destinationAccount || "Cash",
            collectionDate: date || new Date(),
            notes
        });

        console.log("[record expense][SUCCESS] Expense Recorded:", expense._id);

        res.status(201).json({ success: true, data: expense });
    } catch (error) {
        console.error("[record expense][ERROR]", error);
        res.status(500).json({
            success: false,
            message: "Failed to record expense",
            error: error.message
        });
    }
};

/**
 * 6. Get Stats
 */
exports.getStats = async (req, res) => {
    console.log("[get stats][INFO] API HIT");

    try {
        let { company, month, year } = req.query;
        
        // --- MULTI-COMPANY CONTEXT FALLBACK ---
        if (!company || company === "All Companies") {
            company = req.user.activeCompanyName;
        }

        let query = {};

        const isGlobalAdmin = req.user.role === "Superadmin" || req.user.email === "yogeshnarola@kriyonastudio.com";
        
        if (isGlobalAdmin) {
            if (company && company !== "All Companies") {
                query.company = company;
            }
        } else {
            // Check if they have access to this company
            const hasAccess = req.user.company?.name === company || 
                              req.user.accessibleCompanies?.some(c => c.name === company);
            
            if (hasAccess) {
                query.company = company;
            } else {
                // If no access to requested company, fallback to their own
                query.company = req.user.activeCompanyName;
            }
        }

        console.log("[get stats][INFO] Calculating stats for:", { company, month, year, user: req.user.email });

        let dateQuery = {};
        if (month && year) {
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0, 23, 59, 59);
            dateQuery = { $gte: startDate, $lte: endDate };
        }

        const sales = await PaymentSale.find({ ...query, ...(month && year ? { saleDate: dateQuery } : {}) });

        // 1. Global Collections (For Net Balance & Account Balances - All Time)
        const globalCollections = await PaymentCollection.find(query);

        // 2. Monthly Collections (For Expense Stats - Specific Month)
        const monthlyCollections = await PaymentCollection.find({ ...query, ...(month && year ? { collectionDate: dateQuery } : {}) });

        let totalSalesValue = 0;
        let totalPending = 0;
        let totalSalesCollected = 0;
        let totalSalesLoss = 0;

        // Global Accumulators
        let globalIncome = 0;
        let globalExpense = 0;
        let totalPersonal = 0;
        let totalCompany = 0;
        let totalCash = 0;
        let totalDirectCollection = 0;

        // Monthly Accumulators
        let monthlyExpense = 0;
        let monthlyOperational = 0;
        let monthlySalary = 0;

        // Sales Stats (Monthly)
        sales.forEach(sale => {
            totalSalesValue += sale.totalAmount;
            if (sale.remainingAmount > 0) {
                totalPending += sale.remainingAmount;
            }
            totalSalesCollected += sale.collectedAmount || 0;
            totalSalesLoss += sale.lossAmount || 0;
        });

        // Global Stats (Net Collection & Account Balances)
        globalCollections.forEach(col => {
            const amount = col.amountCollected;
            if (col.transactionType === "Income") {
                // Direct collections should now INSCREASE global income/available funds
                globalIncome += amount;

                if (col.isDirectCollection) {
                    totalDirectCollection += amount;
                }

                if (col.destinationAccount === "Personal Bank" || col.destinationAccount === "Personal")
                    totalPersonal += amount;
                else if (col.destinationAccount === "Company Bank" || col.destinationAccount === "Company")
                    totalCompany += amount;
                else if (col.destinationAccount === "Cash")
                    totalCash += amount;
            } else {
                globalExpense += amount;
                // Global Expense deduction for balances
                if (col.destinationAccount === "Personal Bank" || col.destinationAccount === "Personal")
                    totalPersonal -= amount;
                else if (col.destinationAccount === "Company Bank" || col.destinationAccount === "Company")
                    totalCompany -= amount;
                else if (col.destinationAccount === "Cash")
                    totalCash -= amount;
            }
        });

        // Monthly Stats (Expenses & Outflow for selected month)
        monthlyCollections.forEach(col => {
            const amount = col.amountCollected;
            if (col.transactionType === "Expense") {
                monthlyExpense += amount;

                if (col.expenseCategory === "Salary") {
                    monthlySalary += amount;
                } else {
                    monthlyOperational += amount;
                }
            }
        });

        console.log("[get stats][SUCCESS] Stats calculated for:", company || "All");

        res.status(200).json({
            success: true,
            data: {
                totalSalesValue,
                totalSalesCollected,
                totalSalesLoss,
                totalCollected: globalIncome - globalExpense,
                totalIncome: globalIncome,
                totalDirectCollection,
                totalExpense: monthlyExpense,
                totalPending,
                totalOperational: monthlyOperational,
                totalSalary: monthlySalary,
                byAccount: {
                    personal: totalPersonal,
                    company: totalCompany,
                    cash: totalCash
                }
            }
        });
    } catch (error) {
        console.error("[get stats][ERROR]", error);
        res.status(500).json({
            success: false,
            message: "Failed to get stats",
            error: error.message
        });
    }
};
/**
 * 7. Update Sale
 */
exports.updateSale = async (req, res) => {
    console.log("[update sale][INFO] API HIT");

    try {
        const { id } = req.params;
        const {
            clientId,
            guestName,
            guestPhone,
            title,
            totalAmount,
            saleDate,
            notes,
            company,
            destinationAccount
        } = req.body;

        const sale = await PaymentSale.findById(id);

        if (!sale) {
            return res.status(404).json({ success: false, message: "Sale not found" });
        }

        // Ownership Check
        // Ownership Check
        const isGlobalAdmin = req.user.role === "Superadmin" || req.user.email === "yogeshnarola@kriyonastudio.com";
        const isCreator = sale.createdBy.toString() === req.user.id;
        const isCompanyOwner = await validateCompanyAccess(req.user, sale.company);

        if (!isGlobalAdmin && !isCreator && !isCompanyOwner) {
            return res.status(403).json({ success: false, message: "Access Denied: Not authorized to update this sale" });
        }

        // Update fields
        sale.client = clientId || null;
        sale.isGuest = !clientId;
        sale.guestName = clientId ? null : guestName;
        sale.guestPhone = clientId ? null : guestPhone;
        sale.title = title || sale.title;
        sale.totalAmount = Number(totalAmount) || sale.totalAmount;
        sale.saleDate = saleDate || sale.saleDate;
        sale.notes = notes;
        sale.company = company || sale.company;
        sale.destinationAccount = destinationAccount || sale.destinationAccount;

        await sale.save();

        console.log("[update sale][SUCCESS] Sale Updated:", sale._id);
        res.status(200).json({ success: true, data: sale });
    } catch (error) {
        console.error("[update sale][ERROR]", error);
        res.status(500).json({ success: false, message: "Failed to update sale", error: error.message });
    }
};

/**
 * 8. Delete Sale
 */
exports.deleteSale = async (req, res) => {
    console.log("[delete sale][INFO] API HIT");

    try {
        const { id } = req.params;
        const sale = await PaymentSale.findById(id);

        if (!sale) {
            return res.status(404).json({ success: false, message: "Sale not found" });
        }

        // Ownership Check
        // Ownership Check
        const isGlobalAdmin = req.user.role === "Superadmin" || req.user.email === "yogeshnarola@kriyonastudio.com";
        const isCreator = sale.createdBy.toString() === req.user.id;
        const isCompanyOwner = await validateCompanyAccess(req.user, sale.company);

        if (!isGlobalAdmin && !isCreator && !isCompanyOwner) {
            return res.status(403).json({ success: false, message: "Access Denied: Not authorized to delete this sale" });
        }

        // Check if sale has collections
        const collections = await PaymentCollection.find({ saleId: id });
        if (collections.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Cannot delete sale with existing payment collections. Delete collections first."
            });
        }

        await PaymentSale.findByIdAndDelete(id);

        console.log("[delete sale][SUCCESS] Sale Deleted:", id);
        res.status(200).json({ success: true, message: "Sale deleted successfully" });
    } catch (error) {
        console.error("[delete sale][ERROR]", error);
        res.status(500).json({ success: false, message: "Failed to delete sale", error: error.message });
    }
};
/**
 * 9. Update Expense
 */
exports.updateExpense = async (req, res) => {
    console.log("[update expense][INFO] API HIT");

    try {
        const { id } = req.params;
        const {
            partyName,
            amountPaid,
            paymentMode,
            destinationAccount,
            date,
            notes,
            company,
            expenseCategory
        } = req.body;

        const expense = await PaymentCollection.findById(id);

        if (!expense) {
            return res.status(404).json({ success: false, message: "Expense not found" });
        }

        if (expense.transactionType !== "Expense") {
            return res.status(400).json({ success: false, message: "This transaction is not an expense" });
        }

        // Ownership Check
        // Ownership Check
        const isGlobalAdmin = req.user.role === "Superadmin" || req.user.email === "yogeshnarola@kriyonastudio.com";
        const isCreator = expense.createdBy.toString() === req.user.id;
        const isCompanyOwner = await validateCompanyAccess(req.user, expense.company);

        if (!isGlobalAdmin && !isCreator && !isCompanyOwner) {
            return res.status(403).json({ success: false, message: "Access Denied: Not authorized to update this expense" });
        }

        // Update fields
        expense.payerName = partyName || expense.payerName;
        expense.amountCollected = Number(amountPaid) || expense.amountCollected;
        expense.paymentMode = paymentMode || expense.paymentMode;
        expense.destinationAccount = destinationAccount || expense.destinationAccount;
        expense.collectionDate = date || expense.collectionDate;
        expense.notes = notes;
        expense.company = company || expense.company;
        expense.expenseCategory = expenseCategory || expense.expenseCategory;

        await expense.save();

        console.log("[update expense][SUCCESS] Expense Updated:", expense._id);
        res.status(200).json({ success: true, data: expense });
    } catch (error) {
        console.error("[update expense][ERROR]", error);
        res.status(500).json({ success: false, message: "Failed to update expense", error: error.message });
    }
};

/**
 * 10. Delete Expense
 */
exports.deleteExpense = async (req, res) => {
    console.log("[delete expense][INFO] API HIT");

    try {
        const { id } = req.params;
        const expense = await PaymentCollection.findById(id);

        if (!expense) {
            return res.status(404).json({ success: false, message: "Expense not found" });
        }

        if (expense.transactionType !== "Expense") {
            return res.status(400).json({ success: false, message: "This transaction is not an expense" });
        }

        // Ownership Check
        // Ownership Check
        const isGlobalAdmin = req.user.role === "Superadmin" || req.user.email === "yogeshnarola@kriyonastudio.com";
        const isCreator = expense.createdBy.toString() === req.user.id;
        const isCompanyOwner = await validateCompanyAccess(req.user, expense.company);

        if (!isGlobalAdmin && !isCreator && !isCompanyOwner) {
            return res.status(403).json({ success: false, message: "Access Denied: Not authorized to delete this expense" });
        }

        await PaymentCollection.findByIdAndDelete(id);

        console.log("[delete expense][SUCCESS] Expense Deleted:", id);
        res.status(200).json({ success: true, message: "Expense deleted successfully" });
    } catch (error) {
        console.error("[delete expense][ERROR]", error);
        res.status(500).json({ success: false, message: "Failed to delete expense", error: error.message });
    }
};
/**
 * 11. Delete Collection (Income)
 */
exports.deleteCollection = async (req, res) => {
    console.log("[delete collection][INFO] API HIT");

    try {
        const { id } = req.params;
        const collection = await PaymentCollection.findById(id);

        if (!collection) {
            return res.status(404).json({ success: false, message: "Collection not found" });
        }

        if (collection.transactionType !== "Income") {
            return res.status(400).json({
                success: false,
                message: "This transaction is not an Income record. Use deleteExpense for expenses."
            });
        }

        // Ownership Check
        // Ownership Check
        const isGlobalAdmin = req.user.role === "Superadmin" || req.user.email === "yogeshnarola@kriyonastudio.com";
        const isCreator = collection.createdBy.toString() === req.user.id;
        const isCompanyOwner = await validateCompanyAccess(req.user, collection.company);

        if (!isGlobalAdmin && !isCreator && !isCompanyOwner) {
            return res.status(403).json({ success: false, message: "Access Denied: Not authorized to delete this collection" });
        }

        // --- EXPENSE CHECK ---
        // Verify if the associated sale has any linked expenses
        if (collection.saleId) {
            const hasExpenses = await PaymentCollection.exists({
                saleId: collection.saleId,
                transactionType: "Expense"
            });

            if (hasExpenses) {
                return res.status(400).json({
                    success: false,
                    message: "Cannot delete collection as there are expenses linked to this sale. Delete expenses first."
                });
            }

            // Sync Sale Balance
            const sale = await PaymentSale.findById(collection.saleId);
            if (sale) {
                sale.collectedAmount -= (collection.amountCollected || 0);
                sale.lossAmount -= (collection.amountLoss || 0);
                await sale.save();
                console.log("[delete collection][INFO] Sale balance synced:", sale._id);
            }
        }

        await PaymentCollection.findByIdAndDelete(id);

        console.log("[delete collection][SUCCESS] Collection Deleted:", id);
        res.status(200).json({ success: true, message: "Collection deleted successfully" });
    } catch (error) {
        console.error("[delete collection][ERROR]", error);
        res.status(500).json({ success: false, message: "Failed to delete collection", error: error.message });
    }
};
/**
 * 12. Update Collection Account Type (Income only)
 */
exports.updateCollectionAccount = async (req, res) => {
    console.log("[update collection account][INFO] API HIT");

    try {
        const { id } = req.params;
        const { destinationAccount } = req.body;

        if (!destinationAccount || !["Company Bank", "Personal Bank", "Cash"].includes(destinationAccount)) {
            return res.status(400).json({
                success: false,
                message: "Invalid account type. Must be Company Bank, Personal Bank, or Cash."
            });
        }

        const collection = await PaymentCollection.findById(id);

        if (!collection) {
            return res.status(404).json({ success: false, message: "Collection not found" });
        }

        if (collection.transactionType !== "Income") {
            return res.status(400).json({
                success: false,
                message: "This transaction is not an Income record."
            });
        }

        // Ownership Check
        const isGlobalAdmin = req.user.role === "Superadmin" || req.user.email === "yogeshnarola@kriyonastudio.com";
        const isCreator = collection.createdBy.toString() === req.user.id;
        const isCompanyOwner = await validateCompanyAccess(req.user, collection.company);

        if (!isGlobalAdmin && !isCreator && !isCompanyOwner) {
            return res.status(403).json({ success: false, message: "Access Denied: Not authorized to update this collection" });
        }

        collection.destinationAccount = destinationAccount;
        await collection.save();

        console.log("[update collection account][SUCCESS] Updated:", id, "->", destinationAccount);
        res.status(200).json({ success: true, data: collection });
    } catch (error) {
        console.error("[update collection account][ERROR]", error);
        res.status(500).json({ success: false, message: "Failed to update collection account", error: error.message });
    }
};

/**
 * 13. Create Direct Collection
 */
exports.createDirectCollection = async (req, res) => {
    console.log("[create direct collection][INFO] API HIT");

    try {
        const {
            title,
            amountCollected,
            company,
            destinationAccount,
            date,
            notes
        } = req.body;

        const collected = Number(amountCollected) || 0;

        const transaction = await PaymentCollection.create({
            createdBy: req.user.id,
            isDirectCollection: true,
            title: title || notes || "Direct Collection",
            payerName: "Direct Collection", // fallback if required
            transactionType: "Income",
            company: company,
            amountCollected: collected,
            destinationAccount,
            collectionDate: date || new Date(),
            notes
        });

        console.log("[create direct collection][SUCCESS] Payment Collected:", transaction._id);

        res.status(200).json({
            success: true,
            data: transaction
        });
    } catch (error) {
        console.error("[create direct collection][ERROR]", error);
        res.status(500).json({
            success: false,
            message: "Failed to create direct collection",
            error: error.message
        });
    }
};

/**
 * 14. Update Direct Collection
 */
exports.updateDirectCollection = async (req, res) => {
    console.log("[update direct collection][INFO] API HIT");

    try {
        const { id } = req.params;
        const {
            title,
            amountCollected,
            company,
            destinationAccount,
            date,
            notes
        } = req.body;

        const collection = await PaymentCollection.findById(id);

        if (!collection) {
            return res.status(404).json({ success: false, message: "Collection not found" });
        }

        if (!collection.isDirectCollection) {
            return res.status(400).json({ success: false, message: "This transaction is not a Direct Collection" });
        }

        // Ownership Check
        const isGlobalAdmin = req.user.role === "Superadmin" || req.user.email === "yogeshnarola@kriyonastudio.com";
        const isCreator = collection.createdBy.toString() === req.user.id;
        const isCompanyOwner = await validateCompanyAccess(req.user, collection.company);

        if (!isGlobalAdmin && !isCreator && !isCompanyOwner) {
            return res.status(403).json({ success: false, message: "Access Denied: Not authorized to update this collection" });
        }

        collection.title = title || collection.title;
        collection.payerName = title || "Direct Collection"; // Keep payerName synced with title for consistency
        collection.amountCollected = Number(amountCollected) || collection.amountCollected;
        collection.company = company || collection.company;
        collection.destinationAccount = destinationAccount || collection.destinationAccount;
        collection.collectionDate = date || collection.collectionDate;
        collection.notes = notes;

        await collection.save();

        console.log("[update direct collection][SUCCESS] Collection Updated:", collection._id);
        res.status(200).json({ success: true, data: collection });
    } catch (error) {
        console.error("[update direct collection][ERROR]", error);
        res.status(500).json({ success: false, message: "Failed to update direct collection", error: error.message });
    }
};

/* eslint-disable no-console */
/**
 * Read-only client setup/folder audit.
 *
 * Usage:
 *   node scripts/audit-client-folder-setup.js --date=2026-05-16
 *   node scripts/audit-client-folder-setup.js --date=2026-05-16 --email=camrdco@gmail.com
 *
 * Notes:
 * - This script does not create folders, retry jobs, or write to MongoDB.
 * - It audits the records available in this backend database:
 *   User, ClientProfile, ClientPackage, ClientSubscription, Schedule, Task.
 * - If folder/drive/queue collections exist in another environment, the script
 *   will detect them by collection name and include raw linked-record counts.
 */

const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config({ path: path.join(__dirname, "..", ".env"), quiet: true });

const User = require("../models/user");
const ClientProfile = require("../models/ClientProfile");
const ClientPackage = require("../models/ClientPackage");
const ClientSubscription = require("../models/ClientSubscription");
const Schedule = require("../models/Schedule");
const Task = require("../models/Task");
const Company = require("../models/Company");

const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, ...rest] = arg.replace(/^--/, "").split("=");
  acc[key] = rest.length ? rest.join("=") : true;
  return acc;
}, {});

const auditDate = String(args.date || "2026-05-16");
const emailFilter = args.email ? String(args.email).toLowerCase() : null;
const outputDir = path.resolve(__dirname, "..", "reports");

const toIstWindow = (yyyyMmDd) => {
  const start = new Date(`${yyyyMmDd}T00:00:00.000+05:30`);
  const end = new Date(`${yyyyMmDd}T23:59:59.999+05:30`);
  return { start, end };
};

const objectIdWindowQuery = (start, end) => ({
  $gte: mongoose.Types.ObjectId.createFromTime(Math.floor(start.getTime() / 1000)),
  $lte: mongoose.Types.ObjectId.createFromTime(Math.floor(end.getTime() / 1000)),
});

const groupByStringKey = (items, keyFn) => {
  const map = new Map();
  for (const item of items) {
    const key = String(keyFn(item));
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
};

const minDate = (items) => {
  const dates = items.map((item) => item.createdAt).filter(Boolean).map((date) => new Date(date));
  return dates.length ? new Date(Math.min(...dates.map(Number))) : null;
};

const maxDate = (items) => {
  const dates = items.map((item) => item.createdAt).filter(Boolean).map((date) => new Date(date));
  return dates.length ? new Date(Math.max(...dates.map(Number))) : null;
};

const hoursBetween = (from, to) => {
  if (!from || !to) return null;
  return Number(((new Date(to).getTime() - new Date(from).getTime()) / 36e5).toFixed(2));
};

const normalize = (value) => (value ? String(value).trim() : "");

const csvEscape = (value) => {
  if (value === null || typeof value === "undefined") return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

async function findCandidateClients(start, end) {
  const userQuery = {
    role: "Client",
    $or: [
      { createdAt: { $gte: start, $lte: end } },
      { _id: objectIdWindowQuery(start, end) },
    ],
  };

  if (emailFilter) userQuery.email = emailFilter;

  const directUsers = await User.find(userQuery)
    .select("_id name email role company createdAt updatedAt")
    .lean();

  const profileQuery = {
    $or: [
      { joinedDate: { $gte: start, $lte: end } },
      { _id: objectIdWindowQuery(start, end) },
    ],
  };

  const dateProfiles = await ClientProfile.find(profileQuery)
    .select("_id user businessName businessEmail clientStatus joinedDate assignedAdmin assignedTeam")
    .lean();

  const userIds = new Set([
    ...directUsers.map((user) => String(user._id)),
    ...dateProfiles.map((profile) => String(profile.user)),
  ]);

  let users = await User.find({ _id: { $in: [...userIds] }, role: "Client" })
    .select("_id name email role company createdAt updatedAt")
    .lean();

  if (emailFilter) users = users.filter((user) => String(user.email).toLowerCase() === emailFilter);

  const profiles = await ClientProfile.find({ user: { $in: users.map((user) => user._id) } })
    .select("_id user businessName businessEmail clientStatus joinedDate assignedAdmin assignedTeam")
    .lean();

  return { users, profiles };
}

async function detectFolderLikeCollections() {
  const collectionInfos = await mongoose.connection.db.listCollections().toArray();
  const names = collectionInfos.map((collection) => collection.name).sort();
  return names.filter((name) => /folder|drive|queue|job|gst|tds|itr/i.test(name));
}

async function countRawFolderLikeRecords(collectionNames, client) {
  const ids = [client.userId, client.profileId].filter(Boolean);
  if (!ids.length || collectionNames.length === 0) return {};

  const counts = {};
  for (const collectionName of collectionNames) {
    const collection = mongoose.connection.db.collection(collectionName);
    const docs = await collection.find({}).limit(5000).toArray();
    counts[collectionName] = docs.filter((doc) => {
      const raw = JSON.stringify(doc);
      return ids.some((id) => raw.includes(id));
    }).length;
  }
  return counts;
}

async function run() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing in my-backend/.env");
  }

  const { start, end } = toIstWindow(auditDate);
  await mongoose.connect(process.env.MONGO_URI);

  const folderLikeCollections = await detectFolderLikeCollections();
  const { users, profiles } = await findCandidateClients(start, end);

  const profileByUser = new Map(profiles.map((profile) => [String(profile.user), profile]));
  const profileIds = profiles.map((profile) => profile._id);
  const userIds = users.map((user) => user._id);

  const [packages, subscriptions, schedules, tasks, companies] = await Promise.all([
    ClientPackage.find({ client: { $in: userIds } })
      .select("_id client packageName status createdAt updatedAt")
      .lean(),
    ClientSubscription.find({ client: { $in: profileIds } })
      .select("_id client packageName status deliverables createdAt updatedAt")
      .lean(),
    Schedule.find({ client: { $in: profileIds } })
      .select("_id client subscription service postType content status createdAt updatedAt")
      .populate("service", "name category")
      .lean(),
    Task.find({ client: { $in: profileIds } })
      .select("_id client title taskCategory status createdAt updatedAt")
      .lean(),
    Company.find({ _id: { $in: users.map((user) => user.company).filter(Boolean) } })
      .select("_id name")
      .lean(),
  ]);

  const packagesByUser = groupByStringKey(packages, (item) => item.client);
  const subscriptionsByProfile = groupByStringKey(subscriptions, (item) => item.client);
  const schedulesByProfile = groupByStringKey(schedules, (item) => item.client);
  const tasksByProfile = groupByStringKey(tasks, (item) => item.client);
  const companyById = new Map(companies.map((company) => [String(company._id), company.name]));

  const rows = [];

  for (const user of users.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))) {
    const profile = profileByUser.get(String(user._id));
    const profileId = profile ? String(profile._id) : null;
    const clientPackages = packagesByUser.get(String(user._id)) || [];
    const clientSubscriptions = profileId ? subscriptionsByProfile.get(profileId) || [] : [];
    const clientSchedules = profileId ? schedulesByProfile.get(profileId) || [] : [];
    const clientTasks = profileId ? tasksByProfile.get(profileId) || [] : [];
    const setupRecords = [...clientPackages, ...clientSubscriptions, ...clientSchedules, ...clientTasks];

    const deliverables = clientSubscriptions.flatMap((subscription) => subscription.deliverables || []);
    const serviceNames = [
      ...deliverables.map((item) => item.serviceName),
      ...clientSchedules.map((schedule) => schedule.service?.name || schedule.postType || schedule.content),
      ...clientTasks.map((task) => task.title || task.taskCategory),
    ].map(normalize).filter(Boolean);

    const problems = [];
    if (!profile) problems.push("missing_client_profile");
    if (clientPackages.length === 0) problems.push("missing_client_package");
    if (clientSubscriptions.length === 0) problems.push("missing_subscription");
    if (clientSchedules.length === 0) problems.push("missing_schedule_items");
    if (clientTasks.length === 0) problems.push("missing_tasks");

    const firstSetupAt = minDate(setupRecords);
    const lastSetupAt = maxDate(setupRecords);
    if (lastSetupAt && lastSetupAt > end) problems.push("setup_records_created_after_audit_day");

    const row = {
      clientName: user.name,
      email: user.email,
      businessName: profile?.businessName || "",
      companyName: user.company ? companyById.get(String(user.company)) || "" : "",
      userId: String(user._id),
      profileId,
      registeredAt: user.createdAt || "",
      joinedDate: profile?.joinedDate || "",
      status: problems.length ? "needs_review" : "complete_evidence",
      problems,
      clientPackageCount: clientPackages.length,
      subscriptionCount: clientSubscriptions.length,
      scheduleItemCount: clientSchedules.length,
      taskCount: clientTasks.length,
      firstSetupAt,
      lastSetupAt,
      delayHoursFromUserCreated: hoursBetween(user.createdAt, lastSetupAt),
      delayHoursFromJoinedDate: hoursBetween(profile?.joinedDate, lastSetupAt),
      gstEvidenceCount: serviceNames.filter((name) => /gst/i.test(name)).length,
      tdsEvidenceCount: serviceNames.filter((name) => /tds/i.test(name)).length,
      itrEvidenceCount: serviceNames.filter((name) => /itr|income tax/i.test(name)).length,
      serviceEvidence: [...new Set(serviceNames)].sort(),
      folderLikeRecordCounts: {},
    };

    row.folderLikeRecordCounts = await countRawFolderLikeRecords(folderLikeCollections, row);
    rows.push(row);
  }

  const summary = {
    auditDateIst: auditDate,
    auditWindowUtc: { start, end },
    emailFilter,
    folderLikeCollections,
    totalClientsInBatch: rows.length,
    completeEvidence: rows.filter((row) => row.status === "complete_evidence").length,
    needsReview: rows.filter((row) => row.status === "needs_review").length,
    missingClientProfile: rows.filter((row) => row.problems.includes("missing_client_profile")).length,
    missingClientPackage: rows.filter((row) => row.problems.includes("missing_client_package")).length,
    missingSubscription: rows.filter((row) => row.problems.includes("missing_subscription")).length,
    missingScheduleItems: rows.filter((row) => row.problems.includes("missing_schedule_items")).length,
    missingTasks: rows.filter((row) => row.problems.includes("missing_tasks")).length,
    setupRecordsCreatedAfterAuditDay: rows.filter((row) => row.problems.includes("setup_records_created_after_audit_day")).length,
    gstEvidenceClients: rows.filter((row) => row.gstEvidenceCount > 0).length,
    tdsEvidenceClients: rows.filter((row) => row.tdsEvidenceCount > 0).length,
    itrEvidenceClients: rows.filter((row) => row.itrEvidenceCount > 0).length,
  };

  fs.mkdirSync(outputDir, { recursive: true });
  const suffix = emailFilter ? `-${emailFilter.replace(/[^a-z0-9]/gi, "_")}` : "";
  const jsonPath = path.join(outputDir, `client-folder-audit-${auditDate}${suffix}.json`);
  const csvPath = path.join(outputDir, `client-folder-audit-${auditDate}${suffix}.csv`);

  fs.writeFileSync(jsonPath, JSON.stringify({ summary, rows }, null, 2));

  const csvHeaders = [
    "clientName",
    "email",
    "businessName",
    "companyName",
    "registeredAt",
    "joinedDate",
    "status",
    "problems",
    "clientPackageCount",
    "subscriptionCount",
    "scheduleItemCount",
    "taskCount",
    "firstSetupAt",
    "lastSetupAt",
    "delayHoursFromUserCreated",
    "delayHoursFromJoinedDate",
    "gstEvidenceCount",
    "tdsEvidenceCount",
    "itrEvidenceCount",
    "userId",
    "profileId",
  ];
  const csv = [
    csvHeaders.join(","),
    ...rows.map((row) => csvHeaders.map((header) => {
      const value = header === "problems" ? row.problems.join("|") : row[header];
      return csvEscape(value);
    }).join(",")),
  ].join("\n");
  fs.writeFileSync(csvPath, csv);

  console.log(JSON.stringify({ summary, jsonPath, csvPath }, null, 2));
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(error);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});

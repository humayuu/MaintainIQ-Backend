import 'dotenv/config';
import mongoose from 'mongoose';

import connectDB from './src/config/db.js';
import User from './src/models/User.js';
import Asset from './src/models/Asset.js';
import Issue from './src/models/Issue.js';
import MaintenanceRecord from './src/models/MaintenanceRecord.js';
import AssetHistory from './src/models/AssetHistory.js';
import { registerUser } from './src/services/authService.js';
import { logHistory } from './src/services/historyService.js';

/**
 * Demo seed script — populates a fresh database with the accounts and sample
 * data needed to log in and demo MaintainIQ end-to-end.
 *
 *   npm run seed
 *
 * It WIPES the domain collections (users, assets, issues, maintenance records,
 * history) and recreates them, so issue numbers and data start clean each run.
 * Refuses to run against NODE_ENV=production unless SEED_FORCE=true is set.
 */

// ── Demo accounts (must match the credentials documented in the READMEs) ──────
const DEMO_USERS = [
  { name: 'Aisha Admin', email: 'admin@maintainiq.com', password: 'Admin@123', role: 'admin' },
  { name: 'Tariq Technician', email: 'tech@maintainiq.com', password: 'Tech@123', role: 'technician' },
  { name: 'Sana Supervisor', email: 'supervisor@maintainiq.com', password: 'Super@123', role: 'supervisor' },
];

const now = new Date();
const daysAgo = (n) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);
const daysFromNow = (n) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000);

async function resetIssueCounter() {
  // The Issue model keeps a private '__IssueCounter' collection for sequential
  // issue numbers. Drop it so a re-seed restarts at ISSUE-00001. Best-effort —
  // unique issue numbers are guaranteed regardless, this is just cosmetic.
  try {
    await mongoose.connection.db.collection('__issuecounters').deleteMany({});
  } catch {
    /* ignore — collection may not exist yet */
  }
}

async function run() {
  if (process.env.NODE_ENV === 'production' && process.env.SEED_FORCE !== 'true') {
    console.error(
      'Refusing to seed a production database. Set SEED_FORCE=true to override.',
    );
    process.exit(1);
  }

  await connectDB();

  // ── 1. Wipe existing demo data ─────────────────────────────────────────────
  console.log('Clearing existing data…');
  await Promise.all([
    User.deleteMany({}),
    Asset.deleteMany({}),
    Issue.deleteMany({}),
    MaintenanceRecord.deleteMany({}),
    AssetHistory.deleteMany({}),
  ]);
  await resetIssueCounter();

  // ── 2. Users (hashed via the real auth service so login works) ─────────────
  console.log('Creating users…');
  const users = {};
  for (const u of DEMO_USERS) {
    const created = await registerUser(u);
    users[created.role] = created;
  }
  const admin = users.admin;
  const tech = users.technician;

  // ── 3. Assets ──────────────────────────────────────────────────────────────
  console.log('Creating assets…');
  const projector = await Asset.create({
    name: 'Classroom Projector 01',
    assetCode: 'PROJ-001',
    category: 'Electronics / AV',
    location: 'Block A — Room 101',
    condition: 'Good',
    manufacturer: 'Epson',
    model: 'EB-X06',
    serialNumber: 'EPX06-233417',
    description: 'Ceiling-mounted classroom projector, 3600 lumens.',
    status: 'Issue Reported',
    assignedTechnician: tech._id,
  });

  const ac = await Asset.create({
    name: 'Split Air Conditioner',
    assetCode: 'AC-014',
    category: 'HVAC',
    location: 'Admin Office',
    condition: 'Fair',
    manufacturer: 'Daikin',
    model: 'FTKF50',
    serialNumber: 'DK50-889201',
    description: '1.5-ton inverter split AC.',
    status: 'Issue Reported',
  });

  const dispenser = await Asset.create({
    name: 'Water Dispenser',
    assetCode: 'WC-002',
    category: 'Appliance',
    location: 'Cafeteria',
    condition: 'Good',
    manufacturer: 'Haier',
    model: 'HWD-2',
    status: 'Operational',
    assignedTechnician: tech._id,
    lastServiceDate: daysAgo(3),
    nextServiceDate: daysFromNow(87),
  });

  const microscope = await Asset.create({
    name: 'Laboratory Microscope',
    assetCode: 'LAB-007',
    category: 'Lab Equipment',
    location: 'Science Lab',
    condition: 'Excellent',
    manufacturer: 'Olympus',
    model: 'CX23',
    status: 'Operational',
    lastServiceDate: daysAgo(30),
    nextServiceDate: daysFromNow(60),
  });

  const cctv = await Asset.create({
    name: 'Corridor CCTV Camera',
    assetCode: 'CCTV-021',
    category: 'Security',
    location: 'Main Corridor — Floor 2',
    condition: 'Good',
    manufacturer: 'Hikvision',
    model: 'DS-2CD1043',
    status: 'Operational',
    nextServiceDate: daysFromNow(20),
  });

  const assets = [projector, ac, dispenser, microscope, cctv];

  // ── 4. Issues ────────────────────────────────────────────────────────────
  console.log('Creating issues…');

  // A) Projector — assigned to the technician, awaiting inspection.
  const issueProjector = await Issue.create({
    asset: projector._id,
    title: 'Projector display flickering and HDMI not detected',
    description:
      'The projector display is flickering and sometimes does not detect HDMI. It works for a few minutes then the screen goes blank.',
    category: 'Display / Connectivity',
    priority: 'High',
    status: 'Assigned',
    reporterName: 'Mr. Kamran (Teacher)',
    reporterContact: 'kamran@example.com',
    assignedTechnician: tech._id,
    aiSuggested: { title: true, category: true, priority: true },
  });

  // B) AC — freshly reported via the public QR page, critical.
  const issueAc = await Issue.create({
    asset: ac._id,
    title: 'Water leakage and reduced cooling',
    description: 'The AC is leaking water, making unusual noise, and cooling is weak.',
    category: 'Leakage / Performance',
    priority: 'Critical',
    status: 'Reported',
    reporterName: 'Public User',
    aiSuggested: { title: true, category: true, priority: true },
  });

  // C) Water dispenser — a fully resolved issue with a maintenance record.
  const issueDispenser = await Issue.create({
    asset: dispenser._id,
    title: 'No cold water and unusual taste',
    description: 'The dispenser is not cooling water and the water has a strange taste.',
    category: 'Performance',
    priority: 'Medium',
    status: 'Resolved',
    reporterName: 'Cafeteria Staff',
    assignedTechnician: tech._id,
  });

  // ── 5. Maintenance record for the resolved issue ───────────────────────────
  console.log('Creating maintenance record…');
  await MaintenanceRecord.create({
    issue: issueDispenser._id,
    asset: dispenser._id,
    technician: tech._id,
    inspectionNotes: 'Inspected cooling coil and inline filter; filter heavily clogged.',
    workPerformed: 'Replaced the water filter cartridge, flushed and sanitized the tank.',
    partsUsed: ['Water filter cartridge'],
    cost: 1500,
    timeSpent: '1h 20m',
    finalCondition: 'Operational',
  });

  // ── 6. Asset history timeline ──────────────────────────────────────────────
  console.log('Creating history entries…');
  await logHistory({ asset: projector._id, action: `Issue reported (${issueProjector.issueNumber})`, relatedIssue: issueProjector._id });
  await logHistory({ asset: projector._id, actor: admin._id, action: `Issue ${issueProjector.issueNumber} assigned to ${tech.name}`, relatedIssue: issueProjector._id });

  await logHistory({ asset: ac._id, action: `Issue reported (${issueAc.issueNumber})`, relatedIssue: issueAc._id });

  await logHistory({ asset: dispenser._id, action: `Issue reported (${issueDispenser.issueNumber})`, relatedIssue: issueDispenser._id });
  await logHistory({ asset: dispenser._id, actor: admin._id, action: `Issue ${issueDispenser.issueNumber} assigned to ${tech.name}`, relatedIssue: issueDispenser._id });
  await logHistory({ asset: dispenser._id, actor: tech._id, action: `Maintenance record added for issue ${issueDispenser.issueNumber}`, relatedIssue: issueDispenser._id });
  await logHistory({ asset: dispenser._id, actor: tech._id, action: `Issue ${issueDispenser.issueNumber} status: Assigned → Resolved`, relatedIssue: issueDispenser._id });

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n✅ Seed complete.\n');
  console.log(`  Users:              ${DEMO_USERS.length}`);
  console.log(`  Assets:             ${assets.length}`);
  console.log(`  Issues:             3  (${issueProjector.issueNumber}, ${issueAc.issueNumber}, ${issueDispenser.issueNumber})`);
  console.log('  Maintenance records: 1');
  console.log('\n  Demo logins:');
  DEMO_USERS.forEach((u) => console.log(`    ${u.role.padEnd(11)} ${u.email}  /  ${u.password}`));
  console.log('');
}

run()
  .catch((err) => {
    console.error('\n❌ Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });

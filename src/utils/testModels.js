/**
 * TEMPORARY verification script — NOT part of the application.
 *
 * Connects to MongoDB, creates one dummy document per model to confirm every
 * schema (validation, hooks, indexes, auto-generated fields) saves correctly,
 * then deletes everything it created. Safe to delete this file after verifying.
 *
 * Run with:  node src/utils/testModels.js
 */
import 'dotenv/config';
import mongoose from 'mongoose';

import User from '../models/User.js';
import Asset from '../models/Asset.js';
import Issue from '../models/Issue.js';
import MaintenanceRecord from '../models/MaintenanceRecord.js';
import AssetHistory from '../models/AssetHistory.js';

const created = [];

const run = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not defined in the environment');

  await mongoose.connect(uri);
  console.log('✅ Connected to MongoDB\n');

  // 1. User
  const user = await User.create({
    name: 'Test Technician',
    email: `test-${Date.now()}@maintainiq.test`,
    password: 'supersecret',
    role: 'technician',
  });
  created.push(user);
  console.log('✔ User          created:', user._id.toString());

  // 2. Asset (publicSlug auto-generated from assetCode in pre-validate hook)
  const asset = await Asset.create({
    name: 'Test Pump',
    assetCode: `PUMP-${Date.now()}`,
    category: 'Machinery',
    location: 'Plant A',
    assignedTechnician: user._id,
    lastServiceDate: new Date('2026-01-01'),
    nextServiceDate: new Date('2026-06-01'),
  });
  created.push(asset);
  console.log('✔ Asset         created:', asset._id.toString(), '| slug:', asset.publicSlug);

  // 3. Issue (issueNumber auto-generated in pre-validate hook)
  const issue = await Issue.create({
    asset: asset._id,
    title: 'Test issue',
    description: 'Pump is making noise',
    priority: 'High',
    reporterName: 'Jane Doe',
    assignedTechnician: user._id,
  });
  created.push(issue);
  console.log('✔ Issue         created:', issue._id.toString(), '| number:', issue.issueNumber);

  // 4. MaintenanceRecord
  const record = await MaintenanceRecord.create({
    issue: issue._id,
    asset: asset._id,
    technician: user._id,
    inspectionNotes: 'Inspected bearings',
    workPerformed: 'Replaced bearing',
    partsUsed: ['bearing-123'],
    cost: 42.5,
    timeSpent: '2h',
    finalCondition: 'Good',
  });
  created.push(record);
  console.log('✔ Maintenance   created:', record._id.toString());

  // 5. AssetHistory
  const history = await AssetHistory.create({
    asset: asset._id,
    actor: user._id,
    action: 'Issue reported',
    relatedIssue: issue._id,
  });
  created.push(history);
  console.log('✔ AssetHistory  created:', history._id.toString());

  console.log('\nAll 5 models saved successfully. Cleaning up...\n');
};

const cleanup = async () => {
  // Delete in reverse dependency order.
  for (const doc of created.reverse()) {
    try {
      await doc.deleteOne();
      console.log('🗑  Deleted:', doc.constructor.modelName, doc._id.toString());
    } catch (err) {
      console.error('⚠  Failed to delete', doc.constructor.modelName, err.message);
    }
  }
};

(async () => {
  let exitCode = 0;
  try {
    await run();
  } catch (err) {
    exitCode = 1;
    console.error('\n❌ Model verification FAILED:\n', err);
  } finally {
    await cleanup();
    await mongoose.disconnect();
    console.log('\n👋 Disconnected. Done.');
    process.exit(exitCode);
  }
})();

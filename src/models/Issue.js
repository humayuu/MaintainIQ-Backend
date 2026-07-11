import mongoose from 'mongoose';

/**
 * Internal, unexported counter used only to generate sequential issue numbers
 * atomically. Kept in this file because it exists solely to serve the Issue
 * schema's pre-validate hook — it is not part of the domain model surface.
 */
const counterSchema = new mongoose.Schema({
  _id: String,
  seq: { type: Number, default: 0 },
});
const IssueCounter =
  mongoose.models.__IssueCounter ||
  mongoose.model('__IssueCounter', counterSchema);

const issueSchema = new mongoose.Schema({
  issueNumber: {
    type: String,
    required: true,
    unique: true,
    // Auto-generated (e.g. ISSUE-00001) in the pre('validate') hook below.
  },
  asset: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Asset',
    required: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    required: true,
  },
  category: {
    type: String,
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Critical'],
    default: 'Medium',
  },
  status: {
    type: String,
    enum: [
      'Reported',
      'Assigned',
      'Inspection Started',
      'Maintenance In Progress',
      'Waiting for Parts',
      'Resolved',
      'Closed',
      'Reopened',
    ],
    default: 'Reported',
  },
  reporterName: {
    type: String,
  },
  reporterContact: {
    type: String,
  },
  assignedTechnician: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  aiSuggested: {
    title: { type: Boolean, default: false },
    category: { type: Boolean, default: false },
    priority: { type: Boolean, default: false },
  },
  evidence: {
    type: [String], // Cloudinary URLs
    default: [],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

/**
 * Assign a readable, sequential issueNumber before validation.
 *
 * Runs on `validate` because issueNumber is `required`. The counter is bumped
 * atomically via findByIdAndUpdate($inc) + upsert, so concurrent creates never
 * collide (unlike a countDocuments()-based scheme, which double-counts under
 * load and after deletes).
 */
issueSchema.pre('validate', async function () {
  if (this.isNew && !this.issueNumber) {
    const counter = await IssueCounter.findByIdAndUpdate(
      'issueNumber',
      { $inc: { seq: 1 } },
      { returnDocument: 'after', upsert: true },
    );
    this.issueNumber = `ISSUE-${String(counter.seq).padStart(5, '0')}`;
  }
});

export const Issue = mongoose.models.Issue || mongoose.model('Issue', issueSchema);

export default Issue;

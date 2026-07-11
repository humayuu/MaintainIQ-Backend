import mongoose from 'mongoose';

const assetSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  assetCode: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  category: {
    type: String,
    required: true,
  },
  location: {
    type: String,
    required: true,
  },
  condition: {
    type: String,
  },
  status: {
    type: String,
    enum: [
      'Operational',
      'Issue Reported',
      'Under Inspection',
      'Under Maintenance',
      'Out of Service',
      'Retired',
    ],
    default: 'Operational',
  },
  assignedTechnician: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  lastServiceDate: {
    type: Date,
  },
  nextServiceDate: {
    type: Date,
  },
  publicSlug: {
    type: String,
    required: true,
    unique: true,
    // Auto-generated from assetCode in the pre('validate') hook below.
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Note: `unique: true` on assetCode and publicSlug already builds those indexes,
// so no explicit schema.index() calls are needed (they would only duplicate them).

/**
 * Derive publicSlug from assetCode and validate service dates.
 *
 * This runs on `validate` (not `save`) because publicSlug is `required` — the
 * value must exist before Mongoose runs required-field validation. Using
 * `this.invalidate` produces a proper ValidationError the API can surface as 400.
 */
assetSchema.pre('validate', function () {
  if (this.assetCode && (this.isModified('assetCode') || !this.publicSlug)) {
    this.publicSlug = this.assetCode
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  if (
    this.lastServiceDate &&
    this.nextServiceDate &&
    this.nextServiceDate < this.lastServiceDate
  ) {
    this.invalidate(
      'nextServiceDate',
      'nextServiceDate cannot be before lastServiceDate',
      this.nextServiceDate,
    );
  }
});

export const Asset = mongoose.models.Asset || mongoose.model('Asset', assetSchema);

export default Asset;

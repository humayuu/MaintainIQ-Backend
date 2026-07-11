import mongoose from 'mongoose';

const maintenanceRecordSchema = new mongoose.Schema({
  issue: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Issue',
    required: true,
  },
  asset: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Asset',
    required: true,
  },
  technician: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  inspectionNotes: {
    type: String,
  },
  workPerformed: {
    type: String,
  },
  partsUsed: {
    type: [String],
    default: [],
  },
  cost: {
    type: Number,
    min: [0, 'cost cannot be negative'],
    default: 0,
  },
  timeSpent: {
    type: String,
  },
  evidence: {
    type: [String], // Cloudinary URLs
    default: [],
  },
  finalCondition: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export const MaintenanceRecord =
  mongoose.models.MaintenanceRecord ||
  mongoose.model('MaintenanceRecord', maintenanceRecordSchema);

export default MaintenanceRecord;

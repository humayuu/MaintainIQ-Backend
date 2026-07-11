import mongoose from 'mongoose';

const assetHistorySchema = new mongoose.Schema({
  asset: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Asset',
    required: true,
    index: true,
  },
  actor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  action: {
    type: String,
    required: true,
  },
  relatedIssue: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Issue',
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

export const AssetHistory =
  mongoose.models.AssetHistory ||
  mongoose.model('AssetHistory', assetHistorySchema);

export default AssetHistory;

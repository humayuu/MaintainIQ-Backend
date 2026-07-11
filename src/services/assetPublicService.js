import Asset from '../models/Asset.js';
import AssetHistory from '../models/AssetHistory.js';

/**
 * Public-facing asset view.
 *
 * SECURITY: this route is unauthenticated, so we build the response object
 * EXPLICITLY from an allowlist of safe fields — never `delete` keys off a full
 * document (easy to miss a field, and future schema additions would leak by
 * default). Anything sensitive — assignedTechnician, cost, inspection/maintenance
 * notes, actor identities — is simply never read here.
 *
 * Returns null when no asset matches the slug (caller sends a clean 404).
 */
export const getPublicAssetBySlug = async (slug) => {
  const asset = await Asset.findOne({ publicSlug: slug });
  if (!asset) {
    return null;
  }

  // Last 3 history entries, action + date ONLY — no actor names, no related IDs.
  const history = await AssetHistory.find({ asset: asset._id })
    .sort({ timestamp: -1 })
    .limit(3)
    .select('action timestamp')
    .lean();

  const activitySummary = history.map((entry) => ({
    action: entry.action,
    date: entry.timestamp,
  }));

  // Explicit allowlist — this object IS the public contract.
  return {
    name: asset.name,
    assetCode: asset.assetCode,
    category: asset.category,
    location: asset.location,
    condition: asset.condition ?? null,
    status: asset.status, // 'Retired' is surfaced here as-is
    lastServiceDate: asset.lastServiceDate ?? null,
    nextServiceDate: asset.nextServiceDate ?? null,
    activitySummary,
  };
};

import Asset from '../models/Asset.js';
import AssetHistory from '../models/AssetHistory.js';
import cache from '../utils/cache.js';

// This unauthenticated slug lookup is the app's most-hit read path (every QR
// scan). We cache the assembled public view for a short window: two DB round
// trips per request collapse to one memory read, and the ~60s TTL bounds how
// stale the activity summary can get on its own. Admin edits to the asset also
// invalidate it explicitly (see invalidatePublicAsset / updateAsset).
const PUBLIC_ASSET_TTL_SECONDS = 60;
const publicAssetKey = (slug) => `public-asset:${slug}`;

/** Drop a slug's cached public view so the next read rebuilds it from the DB. */
export const invalidatePublicAsset = (slug) => {
  if (slug) cache.del(publicAssetKey(slug));
};

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
  const key = publicAssetKey(slug);
  const cached = cache.get(key);
  if (cached !== undefined) {
    return cached; // may be null — a cached "not found" still saves the DB hit
  }

  const asset = await Asset.findOne({ publicSlug: slug });
  if (!asset) {
    // Cache the miss too, briefly, so a scanned-but-unknown slug can't hammer
    // the DB. Short TTL means a newly created asset still appears quickly.
    cache.set(key, null, PUBLIC_ASSET_TTL_SECONDS);
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
  const publicView = {
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

  cache.set(key, publicView, PUBLIC_ASSET_TTL_SECONDS);
  return publicView;
};

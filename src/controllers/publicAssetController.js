import { getPublicAssetBySlug } from '../services/assetPublicService.js';
import asyncHandler from '../utils/asyncHandler.js';

/**
 * GET /api/public/assets/:slug  (no auth)
 * Returns only allowlisted, non-sensitive fields (see assetPublicService).
 * A missing slug returns a clean 404 with no stack trace — handled here
 * directly rather than throwing, so the public response stays minimal.
 */
export const getPublicAsset = asyncHandler(async (req, res) => {
  const asset = await getPublicAssetBySlug(req.params.slug);

  if (!asset) {
    return res.status(404).json({ success: false, message: 'Asset not found' });
  }

  return res.status(200).json({ success: true, data: { asset } });
});

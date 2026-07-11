import AssetHistory from '../models/AssetHistory.js';

/**
 * Append an entry to an asset's history. This is the ONE place AssetHistory
 * documents are created — every controller that changes issue/asset status
 * calls this instead of writing AssetHistory inline.
 *
 * AssetHistory is append-only: there is intentionally no update/delete helper
 * here and no route exposes one.
 *
 * @param {object}   params
 * @param {ObjectId} params.asset         required — the asset the event is about
 * @param {ObjectId} [params.actor]       optional — the user who acted (omit for
 *                                         public/anonymous events)
 * @param {string}   params.action        required — human-readable description
 * @param {ObjectId} [params.relatedIssue] optional — the issue involved
 * @returns {Promise<Document>} the created history entry
 */
export const logHistory = ({ asset, actor, action, relatedIssue } = {}) => {
  if (!asset || !action) {
    throw new Error('logHistory requires at least { asset, action }');
  }

  return AssetHistory.create({
    asset,
    ...(actor ? { actor } : {}),
    action,
    ...(relatedIssue ? { relatedIssue } : {}),
  });
};

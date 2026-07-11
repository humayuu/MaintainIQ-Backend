import Asset from '../models/Asset.js';
import Issue from '../models/Issue.js';
import AssetHistory from '../models/AssetHistory.js';
import asyncHandler from '../utils/asyncHandler.js';
import { triageComplaint } from '../services/aiTriageService.js';
import { logHistory } from '../services/historyService.js';

/**
 * Build a short recent-history summary string for AI context — action + date
 * only, no actor identities.
 */
const buildHistorySummary = async (assetId) => {
  const history = await AssetHistory.find({ asset: assetId })
    .sort({ timestamp: -1 })
    .limit(3)
    .select('action timestamp')
    .lean();

  if (!history.length) return 'none';

  return history
    .map((h) => `${h.action} (${new Date(h.timestamp).toISOString().slice(0, 10)})`)
    .join('; ');
};

const findAssetOr404 = async (slug, res) => {
  const asset = await Asset.findOne({ publicSlug: slug });
  if (!asset) {
    res.status(404).json({ success: false, message: 'Asset not found' });
    return null;
  }
  return asset;
};

/**
 * POST /api/public/assets/:slug/issues/triage  (no auth, rate-limited)
 * Step 1 of 2: run AI triage on the raw complaint and return a suggestion.
 * Saves NOTHING to the database.
 */
export const triageIssuePreview = asyncHandler(async (req, res) => {
  const asset = await findAssetOr404(req.params.slug, res);
  if (!asset) return;

  const complaint = (req.body.complaint || req.body.description || '').trim();
  if (!complaint) {
    return res
      .status(400)
      .json({ success: false, message: 'complaint text is required', errors: null });
  }

  const historySummary = await buildHistorySummary(asset._id);

  const suggestion = await triageComplaint({
    category: asset.category,
    condition: asset.condition,
    location: asset.location,
    historySummary,
    complaint,
  });

  // Preview only — nothing persisted.
  return res.status(200).json({ success: true, data: { suggestion } });
});

/**
 * POST /api/public/assets/:slug/issues  (no auth, rate-limited)
 * Step 2 of 2: submit the reviewed/edited issue. Accepts the final fields plus
 * an aiSuggested object recording which fields came from the AI vs the user.
 * Creates the Issue, flips the asset to 'Issue Reported', and logs history.
 */
export const submitIssue = asyncHandler(async (req, res) => {
  const asset = await findAssetOr404(req.params.slug, res);
  if (!asset) return;

  const {
    title,
    description,
    category,
    priority,
    reporterName,
    reporterContact,
    aiSuggested,
    evidence,
  } = req.body;

  if (!title || !description) {
    return res
      .status(400)
      .json({ success: false, message: 'title and description are required', errors: null });
  }

  const issue = await Issue.create({
    asset: asset._id,
    title,
    description,
    category,
    priority, // model defaults to 'Medium' if omitted
    reporterName,
    reporterContact,
    aiSuggested: aiSuggested || {},
    evidence: Array.isArray(evidence) ? evidence : [],
  });

  // Reflect the report on the asset.
  asset.status = 'Issue Reported';
  await asset.save();

  // Public report → no authenticated actor.
  await logHistory({
    asset: asset._id,
    action: `Issue reported (${issue.issueNumber})`,
    relatedIssue: issue._id,
  });

  return res.status(201).json({ success: true, data: { issue } });
});

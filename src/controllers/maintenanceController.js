import Issue from '../models/Issue.js';
import Asset from '../models/Asset.js';
import MaintenanceRecord from '../models/MaintenanceRecord.js';
import asyncHandler from '../utils/asyncHandler.js';
import { assertValidTransition } from '../services/statusTransitionService.js';
import { logHistory } from '../services/historyService.js';

const httpError = (message, statusCode) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

// Ownership is enforced by technicianOwnsIssue middleware (admins bypass). We
// still load the full issue here since that middleware only stashes req.issue
// for non-admins.
const loadIssueOr404 = async (id) => {
  const issue = await Issue.findById(id);
  if (!issue) throw httpError('Issue not found', 404);
  return issue;
};

/**
 * POST /api/issues/:id/maintenance
 * Create a MaintenanceRecord for the issue.
 */
export const createMaintenance = asyncHandler(async (req, res) => {
  const issue = await loadIssueOr404(req.params.id);

  const {
    inspectionNotes,
    workPerformed,
    partsUsed,
    cost,
    timeSpent,
    evidence,
    finalCondition,
  } = req.body;

  // Defense in depth: schema also enforces min:0, but reject early with a clean 400.
  if (cost !== undefined && (typeof cost !== 'number' || cost < 0)) {
    throw httpError('cost must be a number greater than or equal to 0', 400);
  }

  const record = await MaintenanceRecord.create({
    issue: issue._id,
    asset: issue.asset,
    technician: req.user._id,
    inspectionNotes,
    workPerformed,
    partsUsed: Array.isArray(partsUsed) ? partsUsed : [],
    cost,
    timeSpent,
    evidence: Array.isArray(evidence) ? evidence : [],
    finalCondition,
  });

  await logHistory({
    asset: issue.asset,
    actor: req.user._id,
    action: `Maintenance record added for issue ${issue.issueNumber}`,
    relatedIssue: issue._id,
  });

  res.status(201).json({ success: true, data: { record } });
});

/**
 * PUT /api/issues/:id/status
 * Change issue status through the validated transition graph, with side effects
 * on the related asset for Resolved / critical-safety cases.
 * Body: { status, criticalSafety? }
 */
export const updateStatus = asyncHandler(async (req, res) => {
  const issue = await loadIssueOr404(req.params.id);
  const { status: newStatus, criticalSafety } = req.body;

  if (!newStatus) {
    throw httpError('status is required', 400);
  }

  // A Closed issue is frozen — it must be reopened first (see /reopen). This
  // guard runs before any transition/update logic.
  if (issue.status === 'Closed') {
    throw httpError('This issue is Closed and cannot be edited until it is reopened', 409);
  }

  // Cannot resolve without at least one maintenance record on file.
  if (newStatus === 'Resolved') {
    const recordCount = await MaintenanceRecord.countDocuments({ issue: issue._id });
    if (recordCount === 0) {
      throw httpError('Cannot resolve an issue that has no maintenance records', 400);
    }
  }

  // Validate the transition against the graph (throws a clear 400 if invalid).
  assertValidTransition(issue.status, newStatus);

  const previousStatus = issue.status;
  issue.status = newStatus;
  await issue.save();

  await logHistory({
    asset: issue.asset,
    actor: req.user._id,
    action: `Issue ${issue.issueNumber} status: ${previousStatus} → ${newStatus}`,
    relatedIssue: issue._id,
  });

  // Asset side effects.
  let assetUpdate = null;
  if (newStatus === 'Resolved') {
    assetUpdate = { status: 'Operational', lastServiceDate: new Date() };
  } else if (criticalSafety === true) {
    // Flagging a critical safety issue takes the asset out of service.
    assetUpdate = { status: 'Out of Service' };
  }

  if (assetUpdate) {
    const asset = await Asset.findById(issue.asset);
    if (asset) {
      Object.assign(asset, assetUpdate);
      await asset.save();
      await logHistory({
        asset: asset._id,
        actor: req.user._id,
        action: `Asset status set to ${assetUpdate.status} (issue ${issue.issueNumber})`,
        relatedIssue: issue._id,
      });
    }
  }

  await issue.populate([
    { path: 'asset', select: 'name assetCode status' },
    { path: 'assignedTechnician', select: 'name' },
  ]);

  res.status(200).json({ success: true, data: { issue } });
});

/**
 * PUT /api/issues/:id/reopen
 * Reopen a Resolved or Closed issue (moves it to 'Reopened').
 */
export const reopenIssue = asyncHandler(async (req, res) => {
  const issue = await loadIssueOr404(req.params.id);

  if (issue.status !== 'Resolved' && issue.status !== 'Closed') {
    throw httpError(
      `Only Resolved or Closed issues can be reopened (current: ${issue.status})`,
      400,
    );
  }

  // Also valid per the transition graph: Resolved→Reopened and Closed→Reopened.
  assertValidTransition(issue.status, 'Reopened');

  const previousStatus = issue.status;
  issue.status = 'Reopened';
  await issue.save();

  await logHistory({
    asset: issue.asset,
    actor: req.user._id,
    action: `Issue ${issue.issueNumber} reopened (was ${previousStatus})`,
    relatedIssue: issue._id,
  });

  res.status(200).json({ success: true, data: { issue } });
});

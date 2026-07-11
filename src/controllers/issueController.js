import Issue from '../models/Issue.js';
import User from '../models/User.js';
import MaintenanceRecord from '../models/MaintenanceRecord.js';
import asyncHandler from '../utils/asyncHandler.js';
import { logHistory } from '../services/historyService.js';

const httpError = (message, statusCode) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

/**
 * GET /api/issues  (any authenticated role)
 * Paginated list with optional filters.
 */
export const listIssues = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  const skip = (page - 1) * limit;

  const filter = {};
  for (const key of ['status', 'priority', 'category', 'assignedTechnician']) {
    if (req.query[key]) filter[key] = req.query[key];
  }

  const [issues, total] = await Promise.all([
    Issue.find(filter)
      .populate('asset', 'name assetCode')
      .populate('assignedTechnician', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Issue.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: {
      issues,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) || 0 },
    },
  });
});

/**
 * GET /api/issues/stats  (any authenticated role)
 * Totals + breakdowns for the dashboard, plus a count assigned to the caller.
 * Aggregated server-side so the dashboard is accurate regardless of list caps.
 */
export const getIssueStats = asyncHandler(async (req, res) => {
  const CLOSED = ['Resolved', 'Closed'];

  const [total, open, critical, byStatusAgg, byPriorityAgg, assignedToMe] = await Promise.all([
    Issue.countDocuments(),
    Issue.countDocuments({ status: { $nin: CLOSED } }),
    Issue.countDocuments({ priority: 'Critical', status: { $nin: CLOSED } }),
    Issue.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Issue.aggregate([{ $group: { _id: '$priority', count: { $sum: 1 } } }]),
    Issue.countDocuments({ assignedTechnician: req.user._id }),
  ]);

  const byStatus = {};
  byStatusAgg.forEach((g) => {
    if (g._id) byStatus[g._id] = g.count;
  });
  const byPriority = {};
  byPriorityAgg.forEach((g) => {
    if (g._id) byPriority[g._id] = g.count;
  });

  res.status(200).json({
    success: true,
    data: { total, open, critical, byStatus, byPriority, assignedToMe },
  });
});

/**
 * GET /api/issues/:id  (any authenticated role)
 * Full issue detail with the asset + technician populated and its maintenance
 * records attached (so the client can gate "Resolve" on having a record).
 */
export const getIssue = asyncHandler(async (req, res) => {
  const issue = await Issue.findById(req.params.id)
    .populate('asset', 'name assetCode status')
    .populate('assignedTechnician', 'name email');

  if (!issue) {
    throw httpError('Issue not found', 404);
  }

  const maintenanceRecords = await MaintenanceRecord.find({ issue: issue._id })
    .populate('technician', 'name')
    .sort({ createdAt: -1 })
    .lean();

  const payload = issue.toObject();
  payload.maintenanceRecords = maintenanceRecords;

  res.status(200).json({ success: true, data: { issue: payload } });
});

/**
 * PUT /api/issues/:id/assign  (admin only)
 * Assigns the issue to a technician, sets status to 'Assigned', logs history.
 * Body: { technicianId }
 */
export const assignIssue = asyncHandler(async (req, res) => {
  const { technicianId } = req.body;
  if (!technicianId) {
    throw httpError('technicianId is required', 400);
  }

  const issue = await Issue.findById(req.params.id);
  if (!issue) {
    throw httpError('Issue not found', 404);
  }

  const technician = await User.findById(technicianId);
  if (!technician || technician.role !== 'technician') {
    throw httpError('technicianId must reference a user with the technician role', 400);
  }

  issue.assignedTechnician = technician._id;
  issue.status = 'Assigned';
  await issue.save();

  await logHistory({
    asset: issue.asset,
    actor: req.user._id, // the admin performing the assignment
    action: `Issue ${issue.issueNumber} assigned to ${technician.name}`,
    relatedIssue: issue._id,
  });

  await issue.populate([
    { path: 'asset', select: 'name assetCode' },
    { path: 'assignedTechnician', select: 'name' },
  ]);

  res.status(200).json({ success: true, data: { issue } });
});

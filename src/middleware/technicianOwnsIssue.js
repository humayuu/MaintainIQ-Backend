import Issue from '../models/Issue.js';
import asyncHandler from '../utils/asyncHandler.js';

/**
 * Ownership gate for Phase 6 (maintenance/issue updates). Use after `protect`:
 *   router.patch('/:id', protect, technicianOwnsIssue, handler)
 *
 * - Admins bypass the check entirely.
 * - For everyone else, loads the issue by req.params.id and requires that
 *   req.user._id matches issue.assignedTechnician.
 *
 * The loaded issue is stashed on req.issue so the downstream handler doesn't
 * have to fetch it again. If we later route these under a different param
 * (e.g. :issueId), update the param read below to match.
 */
const technicianOwnsIssue = asyncHandler(async (req, res, next) => {
  if (req.user?.role === 'admin') {
    return next();
  }

  const issue = await Issue.findById(req.params.id);
  if (!issue) {
    const err = new Error('Issue not found');
    err.statusCode = 404;
    throw err;
  }

  const assigned = issue.assignedTechnician;
  if (!assigned || assigned.toString() !== req.user._id.toString()) {
    const err = new Error('You are not assigned to this issue');
    err.statusCode = 403;
    throw err;
  }

  req.issue = issue;
  next();
});

export default technicianOwnsIssue;

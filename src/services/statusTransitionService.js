/**
 * Issue status transition rules.
 *
 * Graph:
 *   Reported → Assigned → Inspection Started → Maintenance In Progress
 *   Maintenance In Progress ⇄ Waiting for Parts
 *   Maintenance In Progress / Waiting for Parts → Resolved
 *   Resolved → Reopened → Assigned
 *   Resolved → Closed
 *   Closed → Reopened   (the only way to touch a closed issue again)
 *
 * Note: both "Maintenance In Progress" and "Waiting for Parts" may go to
 * "Resolved" — the active-work cluster resolves the issue. If you intend a
 * stricter graph (only Waiting for Parts → Resolved), remove that one edge.
 */
const TRANSITIONS = {
  Reported: ['Assigned'],
  Assigned: ['Inspection Started'],
  'Inspection Started': ['Maintenance In Progress'],
  'Maintenance In Progress': ['Waiting for Parts', 'Resolved'],
  'Waiting for Parts': ['Maintenance In Progress', 'Resolved'],
  Resolved: ['Reopened', 'Closed'],
  Reopened: ['Assigned'],
  Closed: ['Reopened'],
};

/**
 * @returns {boolean} whether currentStatus → newStatus is an allowed transition.
 */
export const isValidTransition = (currentStatus, newStatus) =>
  Boolean(TRANSITIONS[currentStatus]?.includes(newStatus));

/**
 * Throws a clear 400 error (naming both statuses) if the transition is invalid.
 */
export const assertValidTransition = (currentStatus, newStatus) => {
  if (!isValidTransition(currentStatus, newStatus)) {
    const allowed = TRANSITIONS[currentStatus]?.length
      ? TRANSITIONS[currentStatus].join(', ')
      : '(none)';
    const err = new Error(
      `Invalid status transition: "${currentStatus}" → "${newStatus}". ` +
        `Allowed from "${currentStatus}": ${allowed}.`,
    );
    err.statusCode = 400;
    throw err;
  }
};

export const STATUS_TRANSITIONS = TRANSITIONS;

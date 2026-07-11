/**
 * Liveness probe. Returns a minimal payload so uptime checks and load
 * balancers can confirm the API process is up.
 */
export const getHealth = (req, res) => {
  res.status(200).json({ status: 'ok' });
};

import NodeCache from 'node-cache';

/**
 * Shared in-memory cache (single process-wide instance).
 *
 * SCOPE: deliberately used in ONLY a few high-value spots — currently the public
 * asset-by-slug lookup (the unauthenticated QR-scan endpoint, the app's most-hit
 * read path). It is NOT a general query cache; don't wrap authenticated or
 * write-adjacent reads in it without a clear invalidation story.
 *
 * NOTES:
 *  - In-memory only: cache is per-process and clears on restart. If this API is
 *    ever run as multiple instances, each keeps its own copy — fine here because
 *    entries are short-lived (see TTLs at call sites) and read-only.
 *  - useClones:false returns the stored reference directly (no per-get deep
 *    clone). Safe because we only cache plain, already-sanitised response objects
 *    that callers treat as read-only.
 */
const cache = new NodeCache({ checkperiod: 120, useClones: false });

export default cache;

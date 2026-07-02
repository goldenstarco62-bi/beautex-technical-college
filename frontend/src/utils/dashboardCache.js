/**
 * dashboardCache.js
 *
 * Lightweight in-memory TTL cache for student dashboard data.
 * Prevents re-fetching all data when a student navigates away and back within
 * the same browser session. Cache entries expire after TTL_MS milliseconds.
 */

const TTL_MS = 60_000; // 60 seconds

/** @type {Map<string, { data: any, expiresAt: number }>} */
const cache = new Map();

/**
 * Read a cached value for the given key.
 * Returns null if the entry doesn't exist or has expired.
 * @param {string} key
 * @returns {any | null}
 */
export function cacheGet(key) {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        cache.delete(key);
        return null;
    }
    return entry.data;
}

/**
 * Store a value in the cache with a TTL.
 * @param {string} key
 * @param {any} data
 * @param {number} [ttl] — override TTL in milliseconds (default: 60s)
 */
export function cacheSet(key, data, ttl = TTL_MS) {
    cache.set(key, { data, expiresAt: Date.now() + ttl });
}

/**
 * Manually invalidate a cached key (e.g., after an explicit refresh).
 * @param {string} key
 */
export function cacheInvalidate(key) {
    cache.delete(key);
}

/**
 * Returns the cache key for a given student's dashboard.
 * @param {string} studentId
 * @returns {string}
 */
export function studentDashboardKey(studentId) {
    return `student-dashboard:${studentId}`;
}

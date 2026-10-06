/**
 * High-performance in-memory TTL Cache
 * Provides sub-millisecond retrieval for frequently requested database entities
 * (e.g. system settings, active course lists, dashboard stats).
 */

class MemoryCache {
    constructor() {
        this.cache = new Map();
    }

    /**
     * Get cached item if valid and not expired.
     * @param {string} key 
     * @returns {any|null}
     */
    get(key) {
        const item = this.cache.get(key);
        if (!item) return null;

        if (Date.now() > item.expiry) {
            this.cache.delete(key);
            return null;
        }

        return item.value;
    }

    /**
     * Set cache entry with TTL in milliseconds (default: 60,000ms / 60 seconds)
     * @param {string} key 
     * @param {any} value 
     * @param {number} ttlMs 
     */
    set(key, value, ttlMs = 60000) {
        this.cache.set(key, {
            value,
            expiry: Date.now() + ttlMs
        });
    }

    /**
     * Delete item or purge by key prefix
     * @param {string} keyOrPrefix 
     */
    del(keyOrPrefix) {
        for (const k of this.cache.keys()) {
            if (k === keyOrPrefix || k.startsWith(keyOrPrefix)) {
                this.cache.delete(k);
            }
        }
    }

    /**
     * Clear all cached data
     */
    flush() {
        this.cache.clear();
    }
}

export const memoryCache = new MemoryCache();
export default memoryCache;

/**
 * In-Memory Company-Scoped Cache Manager
 * 
 * Provides bounded TTL caching for high-read, low-write company reference data:
 * - Categories, Brands, Colors, Sizes
 * - Business settings & profiles
 * 
 * Guarantees company isolation:
 * - Keys are always prefixed with the verified company/business ID: `biz:<companyId>:<key>`
 * - Automatically evicts expired entries
 * - Manual invalidation on mutation
 */

class MemoryCacheManager {
  constructor(defaultTtlMs = 5 * 60 * 1000) { // 5 minutes default TTL
    this.cache = new Map();
    this.defaultTtlMs = defaultTtlMs;
  }

  _formatKey(businessId, key) {
    if (!businessId) throw new Error('Business ID is strictly required for cache keys to prevent cross-tenant leaks.');
    return `biz:${businessId}:${key}`;
  }

  get(businessId, key) {
    const fullKey = this._formatKey(businessId, key);
    const entry = this.cache.get(fullKey);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(fullKey);
      return null;
    }

    return entry.value;
  }

  set(businessId, key, value, ttlMs = this.defaultTtlMs) {
    const fullKey = this._formatKey(businessId, key);
    this.cache.set(fullKey, {
      value,
      expiresAt: Date.now() + ttlMs
    });
  }

  invalidate(businessId, key) {
    const fullKey = this._formatKey(businessId, key);
    this.cache.delete(fullKey);
  }

  invalidateAllForBusiness(businessId) {
    const prefix = `biz:${businessId}:`;
    for (const k of this.cache.keys()) {
      if (k.startsWith(prefix)) {
        this.cache.delete(k);
      }
    }
  }

  clear() {
    this.cache.clear();
  }
}

const memoryCache = new MemoryCacheManager();

module.exports = { memoryCache };

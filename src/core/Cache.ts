/**
 * Simple In-Memory Cache System
 * Provides caching capabilities with TTL support
 */

import { Logger } from '../utils/logger';

export interface CacheEntry<T = any> {
    value: T;
    expireAt: number;
    createdAt: number;
    hits: number;
}

export interface CacheStats {
    totalEntries: number;
    hits: number;
    misses: number;
    hitRate: number;
    memoryUsage: number;
}

export interface CacheOptions {
    defaultTtlMs?: number;
    maxEntries?: number;
    checkExpirationIntervalMs?: number;
}

export class CacheService {
    private cache = new Map<string, CacheEntry>();
    private stats = { hits: 0, misses: 0 };
    private defaultTtlMs: number;
    private maxEntries: number;
    private logger?: Logger;
    private cleanupInterval?: NodeJS.Timeout;

    constructor(options: CacheOptions = {}, logger?: Logger) {
        this.defaultTtlMs = options.defaultTtlMs || 3600000; // 1 hour default
        this.maxEntries = options.maxEntries || 1000;
        this.logger = logger;

        // Start cleanup interval
        if (options.checkExpirationIntervalMs !== 0) {
            const interval = options.checkExpirationIntervalMs || 300000; // 5 minutes default
            this.startCleanupInterval(interval);
        }
    }

    /**
     * Set a value in cache
     */
    set<T>(key: string, value: T, ttlMs?: number): void {
        const expireAt = Date.now() + (ttlMs || this.defaultTtlMs);
        
        // Check if we need to evict entries
        if (this.cache.size >= this.maxEntries && !this.cache.has(key)) {
            this.evictOldestEntry();
        }

        this.cache.set(key, {
            value,
            expireAt,
            createdAt: Date.now(),
            hits: 0
        });

        this.logger?.debug(`Cache SET: ${key}`, { ttlMs: ttlMs || this.defaultTtlMs });
    }

    /**
     * Get a value from cache
     */
    get<T>(key: string): T | undefined {
        const entry = this.cache.get(key);

        if (!entry) {
            this.stats.misses++;
            this.logger?.debug(`Cache MISS: ${key}`);
            return undefined;
        }

        // Check if expired
        if (Date.now() > entry.expireAt) {
            this.cache.delete(key);
            this.stats.misses++;
            this.logger?.debug(`Cache EXPIRED: ${key}`);
            return undefined;
        }

        // Update hit count and stats
        entry.hits++;
        this.stats.hits++;
        this.logger?.debug(`Cache HIT: ${key}`, { hits: entry.hits });

        return entry.value as T;
    }

    /**
     * Check if key exists and is not expired
     */
    has(key: string): boolean {
        const entry = this.cache.get(key);
        
        if (!entry) {
            return false;
        }

        if (Date.now() > entry.expireAt) {
            this.cache.delete(key);
            return false;
        }

        return true;
    }

    /**
     * Delete a key from cache
     */
    delete(key: string): boolean {
        const deleted = this.cache.delete(key);
        if (deleted) {
            this.logger?.debug(`Cache DELETE: ${key}`);
        }
        return deleted;
    }

    /**
     * Clear all cache entries
     */
    clear(): void {
        const count = this.cache.size;
        this.cache.clear();
        this.stats.hits = 0;
        this.stats.misses = 0;
        this.logger?.info(`Cache cleared: ${count} entries removed`);
    }

    /**
     * Get or set pattern (cache-aside)
     */
    async getOrSet<T>(
        key: string, 
        factory: () => Promise<T> | T, 
        ttlMs?: number
    ): Promise<T> {
        const cached = this.get<T>(key);
        
        if (cached !== undefined) {
            return cached;
        }

        // Generate value
        const value = await factory();
        this.set(key, value, ttlMs);
        
        return value;
    }

    /**
     * Get cache statistics
     */
    getStats(): CacheStats {
        const totalRequests = this.stats.hits + this.stats.misses;
        const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;
        
        // Estimate memory usage
        const memoryUsage = this.estimateMemoryUsage();

        return {
            totalEntries: this.cache.size,
            hits: this.stats.hits,
            misses: this.stats.misses,
            hitRate: Math.round(hitRate * 10000) / 100, // Percentage with 2 decimals
            memoryUsage
        };
    }

    /**
     * Get all cache keys
     */
    keys(): string[] {
        return Array.from(this.cache.keys());
    }

    /**
     * Get cache entry info
     */
    getEntryInfo(key: string): Omit<CacheEntry, 'value'> | undefined {
        const entry = this.cache.get(key);
        if (!entry) {
            return undefined;
        }

        return {
            expireAt: entry.expireAt,
            createdAt: entry.createdAt,
            hits: entry.hits
        };
    }

    /**
     * Refresh TTL for existing entry
     */
    touch(key: string, ttlMs?: number): boolean {
        const entry = this.cache.get(key);
        if (!entry) {
            return false;
        }

        entry.expireAt = Date.now() + (ttlMs || this.defaultTtlMs);
        this.logger?.debug(`Cache TOUCH: ${key}`, { newTtlMs: ttlMs || this.defaultTtlMs });
        
        return true;
    }

    /**
     * Get entries that will expire within specified time
     */
    getExpiringEntries(withinMs: number = 60000): string[] {
        const cutoff = Date.now() + withinMs;
        const expiring: string[] = [];

        for (const [key, entry] of this.cache.entries()) {
            if (entry.expireAt <= cutoff) {
                expiring.push(key);
            }
        }

        return expiring;
    }

    /**
     * Cleanup expired entries
     */
    cleanup(): number {
        const now = Date.now();
        let removedCount = 0;

        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expireAt) {
                this.cache.delete(key);
                removedCount++;
            }
        }

        if (removedCount > 0) {
            this.logger?.debug(`Cache cleanup: removed ${removedCount} expired entries`);
        }

        return removedCount;
    }

    /**
     * Start automatic cleanup interval
     */
    private startCleanupInterval(intervalMs: number): void {
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, intervalMs);

        this.logger?.info(`Cache cleanup interval started: ${intervalMs}ms`);
    }

    /**
     * Stop cleanup interval
     */
    stopCleanupInterval(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = undefined;
            this.logger?.info('Cache cleanup interval stopped');
        }
    }

    /**
     * Evict oldest entry when cache is full
     */
    private evictOldestEntry(): void {
        let oldestKey: string | undefined;
        let oldestTime = Date.now();

        for (const [key, entry] of this.cache.entries()) {
            if (entry.createdAt < oldestTime) {
                oldestTime = entry.createdAt;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            this.cache.delete(oldestKey);
            this.logger?.debug(`Cache eviction: removed oldest entry ${oldestKey}`);
        }
    }

    /**
     * Estimate memory usage (rough calculation)
     */
    private estimateMemoryUsage(): number {
        let totalSize = 0;

        for (const [key, entry] of this.cache.entries()) {
            // Rough estimation: key + JSON serialized value
            totalSize += key.length * 2; // UTF-16 characters
            try {
                totalSize += JSON.stringify(entry.value).length * 2;
            } catch {
                // Fallback for non-serializable values
                totalSize += 100; // Rough estimate
            }
            totalSize += 40; // Overhead for entry metadata
        }

        return totalSize;
    }

    /**
     * Create cache middleware for functions
     */
    memoize<TArgs extends any[], TReturn>(
        fn: (...args: TArgs) => Promise<TReturn> | TReturn,
        keyGenerator?: (...args: TArgs) => string,
        ttlMs?: number
    ): (...args: TArgs) => Promise<TReturn> {
        return async (...args: TArgs): Promise<TReturn> => {
            const key = keyGenerator ? keyGenerator(...args) : `memoize:${JSON.stringify(args)}`;
            
            return this.getOrSet(key, () => fn(...args), ttlMs);
        };
    }

    /**
     * Destroy cache and cleanup resources
     */
    destroy(): void {
        this.stopCleanupInterval();
        this.clear();
        this.logger?.info('Cache service destroyed');
    }

    /**
     * Create cache health check
     */
    createHealthCheck() {
        return async () => {
            const stats = this.getStats();
            
            let status: 'pass' | 'warn' | 'fail' = 'pass';
            let message = `Cache: ${stats.totalEntries} entries, ${stats.hitRate}% hit rate`;

            // Warn if hit rate is low
            if (stats.hitRate < 50 && stats.hits + stats.misses > 100) {
                status = 'warn';
                message += ' (low hit rate)';
            }

            // Warn if cache is nearly full
            if (stats.totalEntries > this.maxEntries * 0.9) {
                status = 'warn';
                message += ' (nearly full)';
            }

            return {
                name: 'cache',
                status,
                duration: 0,
                message
            };
        };
    }
}

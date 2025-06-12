/**
 * In-Memory Cache Provider
 * Fast, local cache implementation with TTL support
 */

import { ICacheProvider, CacheEntry, CacheStats, CacheOptions } from '../interfaces/ICacheProvider';

export class MemoryCacheProvider implements ICacheProvider {
    private cache = new Map<string, CacheEntry>();
    private stats = { hits: 0, misses: 0 };
    private options: Required<CacheOptions>;
    private cleanupInterval?: NodeJS.Timeout;

    constructor(options: CacheOptions = {}) {
        this.options = {
            defaultTtlMs: options.defaultTtlMs || 3600000, // 1 hour
            maxEntries: options.maxEntries || 1000,
            checkExpirationIntervalMs: options.checkExpirationIntervalMs || 300000, // 5 minutes
            namespace: options.namespace || 'default'
        };

        this.startCleanupInterval();
    }

    async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
        const namespacedKey = this.getNamespacedKey(key);
        const ttl = ttlMs || this.options.defaultTtlMs;
        const expireAt = Date.now() + ttl;

        // Check max entries limit
        if (this.cache.size >= this.options.maxEntries && !this.cache.has(namespacedKey)) {
            // Remove oldest entry
            const firstKey = this.cache.keys().next().value;
            if (firstKey) {
                this.cache.delete(firstKey);
            }
        }

        const entry: CacheEntry<T> = {
            value,
            expireAt,
            createdAt: Date.now(),
            hits: 0
        };

        this.cache.set(namespacedKey, entry);
    }

    async get<T>(key: string): Promise<T | null> {
        const namespacedKey = this.getNamespacedKey(key);
        const entry = this.cache.get(namespacedKey);

        if (!entry) {
            this.stats.misses++;
            return null;
        }

        if (Date.now() > entry.expireAt) {
            this.cache.delete(namespacedKey);
            this.stats.misses++;
            return null;
        }

        entry.hits++;
        this.stats.hits++;
        return entry.value as T;
    }

    async has(key: string): Promise<boolean> {
        const namespacedKey = this.getNamespacedKey(key);
        const entry = this.cache.get(namespacedKey);
        
        if (!entry) return false;
        
        if (Date.now() > entry.expireAt) {
            this.cache.delete(namespacedKey);
            return false;
        }
        
        return true;
    }

    async delete(key: string): Promise<boolean> {
        const namespacedKey = this.getNamespacedKey(key);
        return this.cache.delete(namespacedKey);
    }

    async clear(): Promise<void> {
        this.cache.clear();
        this.stats = { hits: 0, misses: 0 };
    }

    async getStats(): Promise<CacheStats> {
        const total = this.stats.hits + this.stats.misses;
        const hitRate = total > 0 ? this.stats.hits / total : 0;
        
        return {
            totalEntries: this.cache.size,
            hits: this.stats.hits,
            misses: this.stats.misses,
            hitRate,
            memoryUsage: this.estimateMemoryUsage(),
            providerSpecific: {
                type: 'memory',
                maxEntries: this.options.maxEntries,
                namespace: this.options.namespace
            }
        };
    }

    async keys(pattern?: string): Promise<string[]> {
        const allKeys = Array.from(this.cache.keys());
        const namespacePrefix = `${this.options.namespace}:`;
        
        // Remove namespace prefix and filter expired
        const validKeys: string[] = [];
        for (const namespacedKey of allKeys) {
            const entry = this.cache.get(namespacedKey);
            if (entry && Date.now() <= entry.expireAt) {
                const key = namespacedKey.startsWith(namespacePrefix) 
                    ? namespacedKey.substring(namespacePrefix.length)
                    : namespacedKey;
                
                if (!pattern || this.matchPattern(key, pattern)) {
                    validKeys.push(key);
                }
            }
        }
        
        return validKeys;
    }

    async mset(entries: Record<string, any>, ttlMs?: number): Promise<void> {
        const promises = Object.entries(entries).map(([key, value]) => 
            this.set(key, value, ttlMs)
        );
        await Promise.all(promises);
    }

    async mget<T>(keys: string[]): Promise<Record<string, T | null>> {
        const result: Record<string, T | null> = {};
        const promises = keys.map(async (key) => {
            result[key] = await this.get<T>(key);
        });
        await Promise.all(promises);
        return result;
    }

    async cleanup(): Promise<number> {
        let removedCount = 0;
        const now = Date.now();
        
        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expireAt) {
                this.cache.delete(key);
                removedCount++;
            }
        }
        
        return removedCount;
    }

    async shutdown(): Promise<void> {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = undefined;
        }
        await this.clear();
    }

    private getNamespacedKey(key: string): string {
        return `${this.options.namespace}:${key}`;
    }

    private startCleanupInterval(): void {
        if (this.options.checkExpirationIntervalMs > 0) {
            this.cleanupInterval = setInterval(() => {
                this.cleanup().catch(() => {
                    // Silent cleanup - errors shouldn't break the app
                });
            }, this.options.checkExpirationIntervalMs);
        }
    }

    private estimateMemoryUsage(): number {
        let totalSize = 0;
        for (const [key, entry] of this.cache.entries()) {
            totalSize += key.length * 2; // UTF-16 characters
            totalSize += JSON.stringify(entry).length * 2;
        }
        return totalSize;
    }

    private matchPattern(key: string, pattern: string): boolean {
        // Simple pattern matching - convert glob to regex
        const regexPattern = pattern
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.');
        return new RegExp(`^${regexPattern}$`).test(key);
    }
}

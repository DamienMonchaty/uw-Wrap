/**
 * Cache Provider Interface - Implementation agnostic caching
 * Supports multiple backends: Memory, Redis, etc.
 */

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
    memoryUsage?: number;
    providerSpecific?: Record<string, any>;
}

export interface CacheOptions {
    defaultTtlMs?: number;
    maxEntries?: number;
    checkExpirationIntervalMs?: number;
    namespace?: string;
}

/**
 * Abstract cache provider interface
 * Implementations: MemoryCacheProvider, RedisCacheProvider, etc.
 */
export interface ICacheProvider {
    /**
     * Set a value in cache with optional TTL
     */
    set<T>(key: string, value: T, ttlMs?: number): Promise<void>;
    
    /**
     * Get a value from cache
     */
    get<T>(key: string): Promise<T | null>;
    
    /**
     * Check if key exists in cache
     */
    has(key: string): Promise<boolean>;
    
    /**
     * Delete a specific key
     */
    delete(key: string): Promise<boolean>;
    
    /**
     * Clear all cache entries
     */
    clear(): Promise<void>;
    
    /**
     * Get cache statistics
     */
    getStats(): Promise<CacheStats>;
    
    /**
     * Get all keys (with optional pattern)
     */
    keys(pattern?: string): Promise<string[]>;
    
    /**
     * Set multiple values at once
     */
    mset(entries: Record<string, any>, ttlMs?: number): Promise<void>;
    
    /**
     * Get multiple values at once
     */
    mget<T>(keys: string[]): Promise<Record<string, T | null>>;
    
    /**
     * Cleanup expired entries (for providers that need manual cleanup)
     */
    cleanup(): Promise<number>;
    
    /**
     * Shutdown the cache provider
     */
    shutdown(): Promise<void>;
}

/**
 * Cache service configuration
 */
export interface CacheServiceConfig extends CacheOptions {
    provider?: ICacheProvider;
    enableHealthCheck?: boolean;
}

/**
 * Injectable Cache Service
 * Dependency-injected service with pluggable providers
 */

import { ICacheProvider, CacheServiceConfig, CacheStats } from '../interfaces/ICacheProvider';
import { MemoryCacheProvider } from './MemoryCacheProvider';
import { Service } from '../AutoRegistration';

/**
 * Cache Service with dependency injection support
 * Supports multiple backends through provider injection
 */
@Service('CacheService')
export class CacheService {
    private provider: ICacheProvider;
    private healthCheckEnabled: boolean;

    constructor(config: CacheServiceConfig = {}) {
        this.provider = config.provider || new MemoryCacheProvider(config);
        this.healthCheckEnabled = config.enableHealthCheck !== false;
    }

    /**
     * Set a value in cache with optional TTL
     */
    async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
        return this.provider.set(key, value, ttlMs);
    }

    /**
     * Get a value from cache
     */
    async get<T>(key: string): Promise<T | null> {
        return this.provider.get<T>(key);
    }

    /**
     * Get value with fallback function
     */
    async getOrSet<T>(
        key: string, 
        fallback: () => Promise<T> | T, 
        ttlMs?: number
    ): Promise<T> {
        const cached = await this.get<T>(key);
        if (cached !== null) {
            return cached;
        }

        const value = await fallback();
        await this.set(key, value, ttlMs);
        return value;
    }

    /**
     * Check if key exists in cache
     */
    async has(key: string): Promise<boolean> {
        return this.provider.has(key);
    }

    /**
     * Delete a specific key
     */
    async delete(key: string): Promise<boolean> {
        return this.provider.delete(key);
    }

    /**
     * Delete multiple keys matching pattern
     */
    async deletePattern(pattern: string): Promise<number> {
        const keys = await this.provider.keys(pattern);
        let deletedCount = 0;
        
        for (const key of keys) {
            if (await this.provider.delete(key)) {
                deletedCount++;
            }
        }
        
        return deletedCount;
    }

    /**
     * Clear all cache entries
     */
    async clear(): Promise<void> {
        return this.provider.clear();
    }

    /**
     * Get cache statistics
     */
    async getStats(): Promise<CacheStats> {
        return this.provider.getStats();
    }

    /**
     * Get all keys (with optional pattern)
     */
    async keys(pattern?: string): Promise<string[]> {
        return this.provider.keys(pattern);
    }

    /**
     * Set multiple values at once
     */
    async mset(entries: Record<string, any>, ttlMs?: number): Promise<void> {
        return this.provider.mset(entries, ttlMs);
    }

    /**
     * Get multiple values at once
     */
    async mget<T>(keys: string[]): Promise<Record<string, T | null>> {
        return this.provider.mget<T>(keys);
    }

    /**
     * Cache decorator function for methods
     */
    cache<T>(
        keyGenerator: (...args: any[]) => string,
        ttlMs?: number
    ) {
        const cacheService = this;
        
        return (target: any, propertyName: string, descriptor: PropertyDescriptor) => {
            const method = descriptor.value;

            descriptor.value = async function (...args: any[]): Promise<T> {
                const cacheKey = keyGenerator(...args);
                
                // Try to get from cache first
                const cached = await cacheService.get<T>(cacheKey);
                if (cached !== null) {
                    return cached;
                }

                // Execute original method
                const result = await method.apply(this, args);
                
                // Cache the result
                await cacheService.set(cacheKey, result, ttlMs);
                
                return result;
            };

            return descriptor;
        };
    }

    /**
     * Cleanup expired entries
     */
    async cleanup(): Promise<number> {
        return this.provider.cleanup();
    }

    /**
     * Health check for cache provider
     */
    async healthCheck(): Promise<{
        name: string;
        status: 'pass' | 'warn' | 'fail';
        duration: number;
        message?: string;
        stats?: CacheStats;
    }> {
        if (!this.healthCheckEnabled) {
            return {
                name: 'cache',
                status: 'pass',
                duration: 0,
                message: 'Health check disabled'
            };
        }

        const startTime = Date.now();
        
        try {
            // Test basic cache operations
            const testKey = '__health_check__';
            const testValue = { timestamp: Date.now() };
            
            await this.set(testKey, testValue, 1000); // 1 second TTL
            const retrieved = await this.get(testKey);
            await this.delete(testKey);
            
            const duration = Date.now() - startTime;
            
            if (retrieved && JSON.stringify(retrieved) === JSON.stringify(testValue)) {
                const stats = await this.getStats();
                return {
                    name: 'cache',
                    status: 'pass',
                    duration,
                    message: `Cache is healthy (${stats.totalEntries} entries)`,
                    stats
                };
            } else {
                return {
                    name: 'cache',
                    status: 'fail',
                    duration,
                    message: 'Cache read/write test failed'
                };
            }
        } catch (error) {
            return {
                name: 'cache',
                status: 'fail',
                duration: Date.now() - startTime,
                message: `Cache error: ${(error as Error).message}`
            };
        }
    }

    /**
     * Shutdown the cache service
     */
    async shutdown(): Promise<void> {
        return this.provider.shutdown();
    }

    /**
     * Get the underlying provider (for advanced usage)
     */
    getProvider(): ICacheProvider {
        return this.provider;
    }
}

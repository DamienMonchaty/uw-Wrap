/**
 * Built-in Health Checkers
 * Common health checks for typical application dependencies
 */

import { HealthChecker, HealthCheckResult, HealthCheckConfig } from '../interfaces/IHealthCheckProvider';

/**
 * Memory usage health checker
 */
export const memoryHealthChecker: HealthChecker = async (config?: HealthCheckConfig): Promise<HealthCheckResult> => {
    const startTime = Date.now();
    
    try {
        const memoryUsage = process.memoryUsage();
        const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;
        const heapTotalMB = memoryUsage.heapTotal / 1024 / 1024;
        const rssMB = memoryUsage.rss / 1024 / 1024;
        const heapUsagePercent = (heapUsedMB / heapTotalMB) * 100;
        
        let status: 'pass' | 'warn' | 'fail' = 'pass';
        let message = `Memory usage: ${heapUsedMB.toFixed(2)}MB / ${heapTotalMB.toFixed(2)}MB (${heapUsagePercent.toFixed(1)}%)`;
        
        // Warning thresholds
        if (heapUsagePercent > 85) {
            status = 'fail';
            message += ' - Critical memory usage';
        } else if (heapUsagePercent > 70) {
            status = 'warn';
            message += ' - High memory usage';
        } else if (rssMB > 512) {
            status = 'warn';
            message += ' - High RSS memory';
        }
        
        return {
            name: 'memory',
            status,
            duration: Date.now() - startTime,
            message,
            metadata: {
                heapUsed: heapUsedMB,
                heapTotal: heapTotalMB,
                rss: rssMB,
                external: memoryUsage.external / 1024 / 1024,
                heapUsagePercent: parseFloat(heapUsagePercent.toFixed(1))
            }
        };
    } catch (error) {
        return {
            name: 'memory',
            status: 'fail',
            duration: Date.now() - startTime,
            message: 'Failed to get memory usage',
            error: (error as Error).message
        };
    }
};

/**
 * Event loop lag health checker
 */
export const eventLoopHealthChecker: HealthChecker = async (config?: HealthCheckConfig): Promise<HealthCheckResult> => {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
        const start = process.hrtime.bigint();
        
        setImmediate(() => {
            const lag = Number(process.hrtime.bigint() - start) / 1000000; // Convert to ms
            const duration = Date.now() - startTime;
            
            let status: 'pass' | 'warn' | 'fail' = 'pass';
            let message = `Event loop lag: ${lag.toFixed(2)}ms`;
            
            if (lag > 100) {
                status = 'fail';
                message += ' - Critical event loop lag';
            } else if (lag > 50) {
                status = 'warn';
                message += ' - High event loop lag';
            }
            
            resolve({
                name: 'eventLoop',
                status,
                duration,
                message,
                metadata: {
                    lag: parseFloat(lag.toFixed(2))
                }
            });
        });
    });
};

/**
 * File system health checker
 */
export const fileSystemHealthChecker: HealthChecker = async (config?: HealthCheckConfig): Promise<HealthCheckResult> => {
    const startTime = Date.now();
    
    try {
        const fs = require('fs').promises;
        const path = require('path');
        const testFile = path.join(process.cwd(), '.health-check-temp');
        
        // Test write
        await fs.writeFile(testFile, 'health-check-test');
        
        // Test read
        const content = await fs.readFile(testFile, 'utf8');
        
        // Test delete
        await fs.unlink(testFile);
        
        if (content === 'health-check-test') {
            return {
                name: 'filesystem',
                status: 'pass',
                duration: Date.now() - startTime,
                message: 'File system read/write operations successful',
                metadata: {
                    testPath: testFile
                }
            };
        } else {
            return {
                name: 'filesystem',
                status: 'fail',
                duration: Date.now() - startTime,
                message: 'File system read operation returned unexpected content'
            };
        }
    } catch (error) {
        return {
            name: 'filesystem',
            status: 'fail',
            duration: Date.now() - startTime,
            message: 'File system operations failed',
            error: (error as Error).message
        };
    }
};

/**
 * Database connectivity health checker factory
 */
export const createDatabaseHealthChecker = (getDatabaseProvider: () => any): HealthChecker => {
    return async (config?: HealthCheckConfig): Promise<HealthCheckResult> => {
        const startTime = Date.now();
        
        try {
            const db = getDatabaseProvider();
            
            if (!db) {
                return {
                    name: 'database',
                    status: 'fail',
                    duration: Date.now() - startTime,
                    message: 'Database provider not available'
                };
            }
            
            // Simple ping test
            if (typeof db.ping === 'function') {
                await db.ping();
            } else if (typeof db.query === 'function') {
                await db.query('SELECT 1');
            } else {
                throw new Error('Database provider does not support health checks');
            }
            
            return {
                name: 'database',
                status: 'pass',
                duration: Date.now() - startTime,
                message: 'Database connection successful'
            };
        } catch (error) {
            return {
                name: 'database',
                status: 'fail',
                duration: Date.now() - startTime,
                message: 'Database connection failed',
                error: (error as Error).message
            };
        }
    };
};

/**
 * Cache connectivity health checker factory
 */
export const createCacheHealthChecker = (getCacheService: () => any): HealthChecker => {
    return async (config?: HealthCheckConfig): Promise<HealthCheckResult> => {
        const startTime = Date.now();
        
        try {
            const cache = getCacheService();
            
            if (!cache) {
                return {
                    name: 'cache',
                    status: 'fail',
                    duration: Date.now() - startTime,
                    message: 'Cache service not available'
                };
            }
            
            // Test cache operations
            const testKey = '__health_check_cache__';
            const testValue = { timestamp: Date.now() };
            
            await cache.set(testKey, testValue, 1000);
            const retrieved = await cache.get(testKey);
            await cache.delete(testKey);
            
            if (retrieved && JSON.stringify(retrieved) === JSON.stringify(testValue)) {
                const stats = await cache.getStats();
                return {
                    name: 'cache',
                    status: 'pass',
                    duration: Date.now() - startTime,
                    message: `Cache operations successful (${stats.totalEntries} entries)`,
                    metadata: {
                        totalEntries: stats.totalEntries,
                        hitRate: stats.hitRate
                    }
                };
            } else {
                return {
                    name: 'cache',
                    status: 'fail',
                    duration: Date.now() - startTime,
                    message: 'Cache read/write test failed'
                };
            }
        } catch (error) {
            return {
                name: 'cache',
                status: 'fail',
                duration: Date.now() - startTime,
                message: 'Cache operations failed',
                error: (error as Error).message
            };
        }
    };
};

/**
 * External service health checker factory
 */
export const createExternalServiceHealthChecker = (
    name: string,
    url: string,
    options: { timeout?: number; expectedStatus?: number } = {}
): HealthChecker => {
    return async (config?: HealthCheckConfig): Promise<HealthCheckResult> => {
        const startTime = Date.now();
        
        try {
            // Simple HTTP check - in real implementation would use proper HTTP client
            const response = await fetch(url, {
                method: 'GET',
                signal: AbortSignal.timeout(options.timeout || 5000)
            });
            
            const expectedStatus = options.expectedStatus || 200;
            const duration = Date.now() - startTime;
            
            if (response.status === expectedStatus) {
                return {
                    name,
                    status: 'pass',
                    duration,
                    message: `External service ${url} responded with status ${response.status}`,
                    metadata: {
                        url,
                        status: response.status,
                        statusText: response.statusText
                    }
                };
            } else {
                return {
                    name,
                    status: 'fail',
                    duration,
                    message: `External service ${url} returned unexpected status ${response.status}`,
                    metadata: {
                        url,
                        status: response.status,
                        statusText: response.statusText,
                        expected: expectedStatus
                    }
                };
            }
        } catch (error) {
            return {
                name,
                status: 'fail',
                duration: Date.now() - startTime,
                message: `External service ${url} check failed`,
                error: (error as Error).message,
                metadata: { url }
            };
        }
    };
};

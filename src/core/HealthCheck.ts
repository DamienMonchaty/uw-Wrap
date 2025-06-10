/**
 * Health Check System
 * Built-in health monitoring for the application
 */

import { Container, TYPES } from './IocContainer';
import { Logger } from '../utils/logger';
import { DatabaseProvider } from '../database/interfaces/DatabaseProvider';

export interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    uptime: number;
    version: string;
    environment: string;
    checks: HealthCheckResult[];
}

export interface HealthCheckResult {
    name: string;
    status: 'pass' | 'warn' | 'fail';
    duration: number;
    message?: string;
    error?: string;
}

export type HealthChecker = () => Promise<HealthCheckResult>;

export class HealthCheckService {
    private container: Container;
    private logger: Logger;
    private customCheckers: Map<string, HealthChecker> = new Map();
    private startTime: number = Date.now();

    constructor(container: Container) {
        this.container = container;
        this.logger = container.resolve<Logger>(TYPES.Logger);
    }

    /**
     * Add custom health checker
     */
    addChecker(name: string, checker: HealthChecker): void {
        this.customCheckers.set(name, checker);
    }

    /**
     * Remove health checker
     */
    removeChecker(name: string): boolean {
        const removed = this.customCheckers.delete(name);
        return removed;
    }

    /**
     * Perform all health checks
     */
    async check(): Promise<HealthStatus> {
        const startTime = Date.now();
        // Only log in development
        if (process.env.NODE_ENV === 'development') {
            this.logger.debug('Performing health checks...');
        }

        const checks: HealthCheckResult[] = [];

        // Built-in checks
        checks.push(await this.checkDatabase());
        checks.push(await this.checkMemory());

        // Custom checks
        for (const [name, checker] of this.customCheckers) {
            try {
                const result = await checker();
                checks.push(result);
            } catch (error) {
                checks.push({
                    name,
                    status: 'fail',
                    duration: Date.now() - startTime,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }

        // Determine overall status
        const hasFailures = checks.some(c => c.status === 'fail');
        const hasWarnings = checks.some(c => c.status === 'warn');
        
        let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
        if (hasFailures) {
            overallStatus = 'unhealthy';
        } else if (hasWarnings) {
            overallStatus = 'degraded';
        } else {
            overallStatus = 'healthy';
        }

        const status: HealthStatus = {
            status: overallStatus,
            timestamp: new Date().toISOString(),
            uptime: Math.floor((Date.now() - this.startTime) / 1000),
            version: process.env.npm_package_version || '1.0.0',
            environment: process.env.NODE_ENV || 'development',
            checks
        };

        // Only log detailed results in development or if unhealthy
        if (process.env.NODE_ENV === 'development' || overallStatus === 'unhealthy') {
            this.logger.debug(`Health check completed in ${Date.now() - startTime}ms`, {
                status: overallStatus,
                checkCount: checks.length
            });
        }

        return status;
    }

    /**
     * Check database connectivity
     */
    private async checkDatabase(): Promise<HealthCheckResult> {
        const startTime = Date.now();
        
        try {
            const dbProvider = this.container.resolve<DatabaseProvider>(TYPES.DatabaseProvider);
            
            // Simple connectivity test
            await dbProvider.query('SELECT 1 as test');
            
            return {
                name: 'database',
                status: 'pass',
                duration: Date.now() - startTime,
                message: 'Database is responsive'
            };
        } catch (error) {
            return {
                name: 'database',
                status: 'fail',
                duration: Date.now() - startTime,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Check memory usage
     */
    private async checkMemory(): Promise<HealthCheckResult> {
        const startTime = Date.now();
        
        try {
            const memUsage = process.memoryUsage();
            const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
            const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
            const usage = heapUsedMB / heapTotalMB;

            let status: 'pass' | 'warn' | 'fail' = 'pass';
            let message = `Memory usage: ${heapUsedMB}MB / ${heapTotalMB}MB (${Math.round(usage * 100)}%)`;

            if (usage > 0.9) {
                status = 'fail';
                message += ' - Critical memory usage';
            } else if (usage > 0.7) {
                status = 'warn';
                message += ' - High memory usage';
            }

            return {
                name: 'memory',
                status,
                duration: Date.now() - startTime,
                message
            };
        } catch (error) {
            return {
                name: 'memory',
                status: 'fail',
                duration: Date.now() - startTime,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Quick health check (returns boolean)
     */
    async isHealthy(): Promise<boolean> {
        try {
            const status = await this.check();
            return status.status !== 'unhealthy';
        } catch {
            return false;
        }
    }

    /**
     * Create health check middleware for HTTP endpoints
     */
    createHealthEndpoint() {
        return async (req: any, res: any) => {
            try {
                const status = await this.check();
                
                // Set appropriate HTTP status code
                const httpStatus = status.status === 'healthy' ? 200 : 
                                 status.status === 'degraded' ? 200 : 503;
                
                res.writeStatus(`${httpStatus} ${httpStatus === 200 ? 'OK' : 'Service Unavailable'}`)
                   .writeHeader('Content-Type', 'application/json')
                   .end(JSON.stringify(status, null, 2));
                   
            } catch (error) {
                res.writeStatus('500 Internal Server Error')
                   .writeHeader('Content-Type', 'application/json')
                   .end(JSON.stringify({
                       status: 'unhealthy',
                       error: error instanceof Error ? error.message : String(error),
                       timestamp: new Date().toISOString()
                   }));
            }
        };
    }
}

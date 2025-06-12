/**
 * Injectable Health Check Service
 * Dependency-injected service with pluggable providers and built-in checks
 */

import {
    IHealthCheckProvider,
    HealthCheckServiceConfig,
    HealthChecker,
    HealthCheckResult,
    HealthStatus,
    HealthCheckConfig
} from '../interfaces/IHealthCheckProvider';
import { DefaultHealthCheckProvider } from './DefaultHealthCheckProvider';
import {
    memoryHealthChecker,
    eventLoopHealthChecker,
    fileSystemHealthChecker,
    createDatabaseHealthChecker,
    createCacheHealthChecker
} from './BuiltinHealthCheckers';
import { Service } from '../AutoRegistration';

/**
 * Health Check Service with dependency injection support
 * Supports multiple providers and built-in health checks
 */
@Service('HealthCheckService')
export class HealthCheckService {
    private provider: IHealthCheckProvider;
    private periodicInterval?: NodeJS.Timeout;
    private healthCheckEnabled: boolean;

    constructor(config: HealthCheckServiceConfig = {}) {
        this.provider = config.provider || new DefaultHealthCheckProvider(
            config.version || '1.0.0',
            config.environment || process.env.NODE_ENV || 'development'
        );
        this.healthCheckEnabled = true;

        // Add built-in health checks
        if (config.enableBuiltinChecks !== false) {
            this.addBuiltinHealthChecks();
        }

        // Start periodic health checks
        if (config.enablePeriodicChecks) {
            this.startPeriodicChecks(config.periodicInterval || 60000);
        }
    }

    /**
     * Add a custom health checker
     */
    addChecker(name: string, checker: HealthChecker, config?: HealthCheckConfig): void {
        this.provider.addChecker(name, checker, config);
    }

    /**
     * Remove a health checker
     */
    removeChecker(name: string): boolean {
        return this.provider.removeChecker(name);
    }

    /**
     * Get all registered checker names
     */
    getCheckerNames(): string[] {
        return this.provider.getCheckerNames();
    }

    /**
     * Run a specific health check
     */
    async runChecker(name: string): Promise<HealthCheckResult> {
        return this.provider.runChecker(name);
    }

    /**
     * Run all health checks
     */
    async runAllChecks(): Promise<HealthCheckResult[]> {
        return this.provider.runAllChecks();
    }

    /**
     * Get overall health status
     */
    async getHealthStatus(): Promise<HealthStatus> {
        return this.provider.getHealthStatus();
    }

    /**
     * Enable/disable a specific checker
     */
    setCheckerEnabled(name: string, enabled: boolean): boolean {
        return this.provider.setCheckerEnabled(name, enabled);
    }

    /**
     * Check if a checker is enabled
     */
    isCheckerEnabled(name: string): boolean {
        return this.provider.isCheckerEnabled(name);
    }

    /**
     * Add database health checker
     */
    addDatabaseHealthChecker(getDatabaseProvider: () => any, config?: HealthCheckConfig): void {
        const checker = createDatabaseHealthChecker(getDatabaseProvider);
        this.addChecker('database', checker, { critical: true, ...config });
    }

    /**
     * Add cache health checker
     */
    addCacheHealthChecker(getCacheService: () => any, config?: HealthCheckConfig): void {
        const checker = createCacheHealthChecker(getCacheService);
        this.addChecker('cache', checker, config);
    }

    /**
     * Get health endpoint handler (for HTTP endpoints)
     */
    getHealthEndpoint() {
        return async (req: any, res: any) => {
            try {
                const healthStatus = await this.getHealthStatus();
                const statusCode = healthStatus.status === 'healthy' ? 200 : 
                                  healthStatus.status === 'degraded' ? 200 : 503;
                
                if (typeof res.status === 'function') {
                    res.status(statusCode).json(healthStatus);
                } else {
                    // For uWebSockets.js or similar
                    const response = JSON.stringify(healthStatus);
                    res.writeStatus(statusCode.toString());
                    res.writeHeader('Content-Type', 'application/json');
                    res.end(response);
                }
            } catch (error) {
                const errorResponse = {
                    status: 'unhealthy',
                    timestamp: new Date().toISOString(),
                    error: (error as Error).message
                };
                
                if (typeof res.status === 'function') {
                    res.status(503).json(errorResponse);
                } else {
                    res.writeStatus('503');
                    res.writeHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify(errorResponse));
                }
            }
        };
    }

    /**
     * Get readiness endpoint handler (for Kubernetes readiness probes)
     */
    getReadinessEndpoint() {
        return async (req: any, res: any) => {
            try {
                const checks = await this.runAllChecks();
                const criticalChecks = checks.filter(check => {
                    const name = check.name;
                    // Assume critical checks are database and other essential services
                    return ['database', 'redis', 'external-api'].includes(name);
                });
                
                const isReady = criticalChecks.every(check => check.status === 'pass');
                const statusCode = isReady ? 200 : 503;
                const response = {
                    ready: isReady,
                    timestamp: new Date().toISOString(),
                    criticalChecks: criticalChecks.map(check => ({
                        name: check.name,
                        status: check.status
                    }))
                };
                
                if (typeof res.status === 'function') {
                    res.status(statusCode).json(response);
                } else {
                    res.writeStatus(statusCode.toString());
                    res.writeHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify(response));
                }
            } catch (error) {
                const errorResponse = {
                    ready: false,
                    timestamp: new Date().toISOString(),
                    error: (error as Error).message
                };
                
                if (typeof res.status === 'function') {
                    res.status(503).json(errorResponse);
                } else {
                    res.writeStatus('503');
                    res.writeHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify(errorResponse));
                }
            }
        };
    }

    /**
     * Get liveness endpoint handler (for Kubernetes liveness probes)
     */
    getLivenessEndpoint() {
        return async (req: any, res: any) => {
            // Simple liveness check - just return 200 if service is running
            const response = {
                alive: true,
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                pid: process.pid
            };
            
            if (typeof res.status === 'function') {
                res.status(200).json(response);
            } else {
                res.writeStatus('200');
                res.writeHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(response));
            }
        };
    }

    /**
     * Health check for the health check service itself
     */
    async healthCheck(): Promise<{
        name: string;
        status: 'pass' | 'warn' | 'fail';
        duration: number;
        message?: string;
        checkerCount?: number;
    }> {
        if (!this.healthCheckEnabled) {
            return {
                name: 'healthcheck',
                status: 'pass',
                duration: 0,
                message: 'Health check service disabled'
            };
        }

        const startTime = Date.now();
        
        try {
            const checkerNames = this.getCheckerNames();
            const enabledCheckers = checkerNames.filter(name => this.isCheckerEnabled(name));
            
            return {
                name: 'healthcheck',
                status: 'pass',
                duration: Date.now() - startTime,
                message: `Health check service running (${enabledCheckers.length}/${checkerNames.length} checkers enabled)`,
                checkerCount: checkerNames.length
            };
        } catch (error) {
            return {
                name: 'healthcheck',
                status: 'fail',
                duration: Date.now() - startTime,
                message: `Health check service error: ${(error as Error).message}`
            };
        }
    }

    /**
     * Shutdown the health check service
     */
    async shutdown(): Promise<void> {
        if (this.periodicInterval) {
            clearInterval(this.periodicInterval);
            this.periodicInterval = undefined;
        }
        
        return this.provider.shutdown();
    }

    /**
     * Get the underlying provider (for advanced usage)
     */
    getProvider(): IHealthCheckProvider {
        return this.provider;
    }

    private addBuiltinHealthChecks(): void {
        // Memory usage check
        this.addChecker('memory', memoryHealthChecker, { 
            timeout: 1000, 
            critical: false 
        });

        // Event loop lag check
        this.addChecker('eventLoop', eventLoopHealthChecker, { 
            timeout: 2000, 
            critical: false 
        });

        // File system check
        this.addChecker('filesystem', fileSystemHealthChecker, { 
            timeout: 3000, 
            critical: false 
        });
    }

    private startPeriodicChecks(intervalMs: number): void {
        this.periodicInterval = setInterval(async () => {
            try {
                const healthStatus = await this.getHealthStatus();
                
                // Log unhealthy status
                if (healthStatus.status === 'unhealthy') {
                    console.warn('🔴 Health check failed:', {
                        status: healthStatus.status,
                        failing: healthStatus.summary.failing,
                        checks: healthStatus.checks.filter(c => c.status === 'fail')
                    });
                } else if (healthStatus.status === 'degraded') {
                    console.warn('🟡 Health check degraded:', {
                        status: healthStatus.status,
                        warning: healthStatus.summary.warning,
                        checks: healthStatus.checks.filter(c => c.status === 'warn')
                    });
                }
            } catch (error) {
                console.error('❌ Periodic health check failed:', error);
            }
        }, intervalMs);
    }
}

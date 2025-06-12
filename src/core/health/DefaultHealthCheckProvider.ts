/**
 * Default Health Check Provider
 * In-memory health check management with configurable checkers
 */

import {
    IHealthCheckProvider,
    HealthChecker,
    HealthCheckResult,
    HealthStatus,
    HealthCheckConfig
} from '../interfaces/IHealthCheckProvider';

interface RegisteredChecker {
    checker: HealthChecker;
    config: HealthCheckConfig;
    enabled: boolean;
    lastResult?: HealthCheckResult;
    lastRun?: number;
}

export class DefaultHealthCheckProvider implements IHealthCheckProvider {
    private checkers = new Map<string, RegisteredChecker>();
    private startTime = Date.now();
    private version: string;
    private environment: string;

    constructor(version: string = '1.0.0', environment: string = 'development') {
        this.version = version;
        this.environment = environment;
    }

    addChecker(name: string, checker: HealthChecker, config: HealthCheckConfig = {}): void {
        const defaultConfig: HealthCheckConfig = {
            timeout: 5000,
            retries: 1,
            critical: false,
            ...config
        };

        this.checkers.set(name, {
            checker,
            config: defaultConfig,
            enabled: true
        });
    }

    removeChecker(name: string): boolean {
        return this.checkers.delete(name);
    }

    getCheckerNames(): string[] {
        return Array.from(this.checkers.keys());
    }

    async runChecker(name: string): Promise<HealthCheckResult> {
        const registered = this.checkers.get(name);
        
        if (!registered) {
            return {
                name,
                status: 'fail',
                duration: 0,
                message: 'Health checker not found'
            };
        }

        if (!registered.enabled) {
            return {
                name,
                status: 'warn',
                duration: 0,
                message: 'Health checker disabled'
            };
        }

        const startTime = Date.now();
        let result: HealthCheckResult;

        try {
            // Run with timeout
            result = await this.runWithTimeout(
                registered.checker,
                registered.config,
                registered.config.timeout || 5000
            );
        } catch (error) {
            result = {
                name,
                status: 'fail',
                duration: Date.now() - startTime,
                message: 'Health check execution failed',
                error: (error as Error).message
            };
        }

        // Update last result
        registered.lastResult = result;
        registered.lastRun = Date.now();

        return result;
    }

    async runAllChecks(): Promise<HealthCheckResult[]> {
        const results: HealthCheckResult[] = [];
        const promises: Promise<HealthCheckResult>[] = [];

        for (const name of this.checkers.keys()) {
            promises.push(this.runChecker(name));
        }

        const settledResults = await Promise.allSettled(promises);
        
        settledResults.forEach((settled, index) => {
            const name = Array.from(this.checkers.keys())[index];
            
            if (settled.status === 'fulfilled') {
                results.push(settled.value);
            } else {
                results.push({
                    name,
                    status: 'fail',
                    duration: 0,
                    message: 'Health check promise rejected',
                    error: settled.reason?.message || 'Unknown error'
                });
            }
        });

        return results;
    }

    async getHealthStatus(): Promise<HealthStatus> {
        const checks = await this.runAllChecks();
        
        const summary = {
            total: checks.length,
            passing: checks.filter(c => c.status === 'pass').length,
            warning: checks.filter(c => c.status === 'warn').length,
            failing: checks.filter(c => c.status === 'fail').length
        };

        let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
        
        if (summary.failing > 0) {
            // Check if any failing checks are critical
            const criticalFailing = checks.some(check => {
                const registered = this.checkers.get(check.name);
                return check.status === 'fail' && registered?.config.critical;
            });
            
            overallStatus = criticalFailing ? 'unhealthy' : 'degraded';
        } else if (summary.warning > 0) {
            overallStatus = 'degraded';
        }

        return {
            status: overallStatus,
            timestamp: new Date().toISOString(),
            uptime: (Date.now() - this.startTime) / 1000,
            version: this.version,
            environment: this.environment,
            checks,
            summary
        };
    }

    setCheckerEnabled(name: string, enabled: boolean): boolean {
        const registered = this.checkers.get(name);
        if (registered) {
            registered.enabled = enabled;
            return true;
        }
        return false;
    }

    isCheckerEnabled(name: string): boolean {
        const registered = this.checkers.get(name);
        return registered?.enabled || false;
    }

    clear(): void {
        this.checkers.clear();
    }

    async shutdown(): Promise<void> {
        this.clear();
    }

    private async runWithTimeout(
        checker: HealthChecker,
        config: HealthCheckConfig,
        timeoutMs: number
    ): Promise<HealthCheckResult> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`Health check timed out after ${timeoutMs}ms`));
            }, timeoutMs);

            checker(config)
                .then(result => {
                    clearTimeout(timeout);
                    resolve(result);
                })
                .catch(error => {
                    clearTimeout(timeout);
                    reject(error);
                });
        });
    }
}

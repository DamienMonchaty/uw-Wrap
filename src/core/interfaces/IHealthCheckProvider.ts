/**
 * Health Check Provider Interface - Implementation agnostic health monitoring
 * Supports multiple health check strategies and providers
 */

export interface HealthCheckResult {
    name: string;
    status: 'pass' | 'warn' | 'fail';
    duration: number;
    message?: string;
    error?: string;
    metadata?: Record<string, any>;
}

export interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    uptime: number;
    version: string;
    environment: string;
    checks: HealthCheckResult[];
    summary: {
        total: number;
        passing: number;
        warning: number;
        failing: number;
    };
}

export interface HealthCheckConfig {
    timeout?: number;
    retries?: number;
    interval?: number;
    critical?: boolean;
    tags?: Record<string, string>;
}

export type HealthChecker = (config?: HealthCheckConfig) => Promise<HealthCheckResult>;

/**
 * Health check provider interface
 */
export interface IHealthCheckProvider {
    /**
     * Add a health checker
     */
    addChecker(name: string, checker: HealthChecker, config?: HealthCheckConfig): void;
    
    /**
     * Remove a health checker
     */
    removeChecker(name: string): boolean;
    
    /**
     * Get all registered checker names
     */
    getCheckerNames(): string[];
    
    /**
     * Run a specific health check
     */
    runChecker(name: string): Promise<HealthCheckResult>;
    
    /**
     * Run all health checks
     */
    runAllChecks(): Promise<HealthCheckResult[]>;
    
    /**
     * Get overall health status
     */
    getHealthStatus(): Promise<HealthStatus>;
    
    /**
     * Enable/disable a specific checker
     */
    setCheckerEnabled(name: string, enabled: boolean): boolean;
    
    /**
     * Check if a checker is enabled
     */
    isCheckerEnabled(name: string): boolean;
    
    /**
     * Clear all checkers
     */
    clear(): void;
    
    /**
     * Shutdown the health check provider
     */
    shutdown(): Promise<void>;
}

/**
 * Health check service configuration
 */
export interface HealthCheckServiceConfig {
    provider?: IHealthCheckProvider;
    enableBuiltinChecks?: boolean;
    enablePeriodicChecks?: boolean;
    periodicInterval?: number;
    defaultTimeout?: number;
    version?: string;
    environment?: string;
}

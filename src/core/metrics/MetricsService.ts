/**
 * Injectable Metrics Service
 * Dependency-injected service with pluggable providers
 */

import {
    IMetricsProvider,
    MetricsServiceConfig,
    MetricsSnapshot,
    MetricSummary,
    TimerResult,
    MetricsDecoratorOptions
} from '../interfaces/IMetricsProvider';
import { MemoryMetricsProvider } from './MemoryMetricsProvider';
import { Service } from '../AutoRegistration';

/**
 * Metrics Service with dependency injection support
 * Supports multiple backends through provider injection
 */
@Service('MetricsService')
export class MetricsService {
    private provider: IMetricsProvider;
    private systemMetricsEnabled: boolean;
    private systemMetricsInterval?: NodeJS.Timeout;
    private healthCheckEnabled: boolean;
    private defaultTags: Record<string, string>;

    constructor(config: MetricsServiceConfig = {}) {
        this.provider = config.provider || new MemoryMetricsProvider();
        this.systemMetricsEnabled = config.enableSystemMetrics !== false;
        this.healthCheckEnabled = config.enableHealthCheck !== false;
        this.defaultTags = config.defaultTags || {};

        if (this.systemMetricsEnabled) {
            this.startSystemMetricsCollection(config.systemMetricsInterval || 60000);
        }
    }

    /**
     * Increment a counter
     */
    increment(name: string, value?: number, tags?: Record<string, string>): void {
        const mergedTags = { ...this.defaultTags, ...tags };
        this.provider.increment(name, value, mergedTags);
    }

    /**
     * Decrement a counter
     */
    decrement(name: string, value?: number, tags?: Record<string, string>): void {
        const mergedTags = { ...this.defaultTags, ...tags };
        this.provider.decrement(name, value, mergedTags);
    }

    /**
     * Set a gauge value
     */
    gauge(name: string, value: number, tags?: Record<string, string>): void {
        const mergedTags = { ...this.defaultTags, ...tags };
        this.provider.gauge(name, value, mergedTags);
    }

    /**
     * Record a histogram value
     */
    histogram(name: string, value: number, tags?: Record<string, string>): void {
        const mergedTags = { ...this.defaultTags, ...tags };
        this.provider.histogram(name, value, mergedTags);
    }

    /**
     * Start a timer
     */
    timer(name: string, tags?: Record<string, string>): TimerResult {
        const mergedTags = { ...this.defaultTags, ...tags };
        return this.provider.timer(name, mergedTags);
    }

    /**
     * Record timing manually
     */
    timing(name: string, duration: number, tags?: Record<string, string>): void {
        const mergedTags = { ...this.defaultTags, ...tags };
        this.provider.timing(name, duration, mergedTags);
    }

    /**
     * Measure execution time of a function
     */
    async measureAsync<T>(
        name: string,
        fn: () => Promise<T>,
        tags?: Record<string, string>
    ): Promise<T> {
        const timer = this.timer(name, tags);
        
        try {
            const result = await fn();
            timer.stop();
            return result;
        } catch (error) {
            timer.stop();
            this.increment(`${name}.error`, 1, tags);
            throw error;
        }
    }

    /**
     * Measure execution time of a synchronous function
     */
    measure<T>(
        name: string,
        fn: () => T,
        tags?: Record<string, string>
    ): T {
        const timer = this.timer(name, tags);
        
        try {
            const result = fn();
            timer.stop();
            return result;
        } catch (error) {
            timer.stop();
            this.increment(`${name}.error`, 1, tags);
            throw error;
        }
    }

    /**
     * Get current metrics snapshot
     */
    async getSnapshot(): Promise<MetricsSnapshot> {
        return this.provider.getSnapshot();
    }

    /**
     * Get specific metric
     */
    async getMetric(name: string): Promise<MetricSummary | null> {
        return this.provider.getMetric(name);
    }

    /**
     * Get metrics by pattern
     */
    async getMetrics(pattern?: string): Promise<MetricSummary[]> {
        return this.provider.getMetrics(pattern);
    }

    /**
     * Reset all metrics
     */
    async reset(): Promise<void> {
        return this.provider.reset();
    }

    /**
     * Reset specific metric
     */
    async resetMetric(name: string): Promise<boolean> {
        return this.provider.resetMetric(name);
    }

    /**
     * Metrics decorator for methods
     */
    metrics(options: MetricsDecoratorOptions = {}) {
        const metricsService = this;
        
        return (target: any, propertyName: string, descriptor: PropertyDescriptor) => {
            const method = descriptor.value;
            const metricName = options.name || `${target.constructor.name}.${propertyName}`;
            const metricType = options.type || 'timer';
            const incrementOn = options.incrementOn || 'call';

            descriptor.value = async function (...args: any[]): Promise<any> {
                const tags = { ...options.tags };

                // Counter on call
                if (metricType === 'counter' && incrementOn === 'call') {
                    metricsService.increment(metricName, 1, tags);
                }

                // Timer measurement
                let timer: TimerResult | undefined;
                if (metricType === 'timer') {
                    timer = metricsService.timer(metricName, tags);
                }

                try {
                    const result = await method.apply(this, args);

                    // Counter on success
                    if (metricType === 'counter' && incrementOn === 'success') {
                        metricsService.increment(metricName, 1, tags);
                    }

                    return result;
                } catch (error) {
                    // Counter on error
                    if (metricType === 'counter' && incrementOn === 'error') {
                        metricsService.increment(metricName, 1, tags);
                    }

                    // Error metrics
                    metricsService.increment(`${metricName}.error`, 1, tags);
                    throw error;
                } finally {
                    if (timer) {
                        timer.stop();
                    }
                }
            };

            return descriptor;
        };
    }

    /**
     * Health check for metrics system
     */
    async healthCheck(): Promise<{
        name: string;
        status: 'pass' | 'warn' | 'fail';
        duration: number;
        message?: string;
        metricsCount?: number;
    }> {
        if (!this.healthCheckEnabled) {
            return {
                name: 'metrics',
                status: 'pass',
                duration: 0,
                message: 'Health check disabled'
            };
        }

        const startTime = Date.now();
        
        try {
            const healthResult = await this.provider.healthCheck();
            const duration = Date.now() - startTime;
            
            return {
                name: 'metrics',
                status: healthResult.status,
                duration,
                message: healthResult.message,
                metricsCount: healthResult.metricsCount
            };
        } catch (error) {
            return {
                name: 'metrics',
                status: 'fail',
                duration: Date.now() - startTime,
                message: `Metrics error: ${(error as Error).message}`
            };
        }
    }

    /**
     * Shutdown the metrics service
     */
    async shutdown(): Promise<void> {
        if (this.systemMetricsInterval) {
            clearInterval(this.systemMetricsInterval);
            this.systemMetricsInterval = undefined;
        }
        
        return this.provider.shutdown();
    }

    /**
     * Get the underlying provider (for advanced usage)
     */
    getProvider(): IMetricsProvider {
        return this.provider;
    }

    private startSystemMetricsCollection(intervalMs: number): void {
        this.systemMetricsInterval = setInterval(() => {
            try {
                const memoryUsage = process.memoryUsage();
                const cpuUsage = process.cpuUsage();

                // Memory metrics
                this.gauge('system.memory.rss', memoryUsage.rss);
                this.gauge('system.memory.heapUsed', memoryUsage.heapUsed);
                this.gauge('system.memory.heapTotal', memoryUsage.heapTotal);
                this.gauge('system.memory.external', memoryUsage.external);

                // CPU metrics
                this.gauge('system.cpu.user', cpuUsage.user);
                this.gauge('system.cpu.system', cpuUsage.system);

                // Process metrics
                this.gauge('system.uptime', process.uptime());
                this.gauge('system.pid', process.pid);

                // Event loop lag approximation
                const start = process.hrtime.bigint();
                setImmediate(() => {
                    const lag = Number(process.hrtime.bigint() - start) / 1000000; // Convert to ms
                    this.gauge('system.eventLoopLag', lag);
                });
            } catch (error) {
                // Silent failure - system metrics shouldn't break the app
            }
        }, intervalMs);
    }
}

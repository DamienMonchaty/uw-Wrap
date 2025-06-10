/**
 * Application Metrics and Monitoring System
 * Provides performance monitoring and metrics collection
 */

import { Container, TYPES } from './IocContainer';
import { Logger } from '../utils/logger';

export interface MetricData {
    name: string;
    value: number;
    timestamp: number;
    tags?: Record<string, string>;
    type: 'counter' | 'gauge' | 'histogram' | 'timer';
}

export interface TimerResult {
    stop: () => number;
}

export class MetricsService {
    private container: Container;
    private logger: Logger;
    private metrics: Map<string, MetricData[]> = new Map();
    private counters: Map<string, number> = new Map();
    private gauges: Map<string, number> = new Map();
    private timers: Map<string, number[]> = new Map();

    constructor(container: Container) {
        this.container = container;
        this.logger = container.resolve<Logger>(TYPES.Logger);
    }

    /**
     * Increment a counter
     */
    increment(name: string, value: number = 1, tags?: Record<string, string>): void {
        const current = this.counters.get(name) || 0;
        this.counters.set(name, current + value);
        
        this.recordMetric({
            name,
            value: current + value,
            timestamp: Date.now(),
            tags,
            type: 'counter'
        });
    }

    /**
     * Decrement a counter
     */
    decrement(name: string, value: number = 1, tags?: Record<string, string>): void {
        this.increment(name, -value, tags);
    }

    /**
     * Set a gauge value
     */
    gauge(name: string, value: number, tags?: Record<string, string>): void {
        this.gauges.set(name, value);
        
        this.recordMetric({
            name,
            value,
            timestamp: Date.now(),
            tags,
            type: 'gauge'
        });
    }

    /**
     * Start a timer
     */
    timer(name: string, tags?: Record<string, string>): TimerResult {
        const startTime = Date.now();
        
        return {
            stop: (): number => {
                const duration = Date.now() - startTime;
                this.timing(name, duration, tags);
                return duration;
            }
        };
    }

    /**
     * Record a timing
     */
    timing(name: string, duration: number, tags?: Record<string, string>): void {
        const timings = this.timers.get(name) || [];
        timings.push(duration);
        
        // Keep only last 1000 timings per metric
        if (timings.length > 1000) {
            timings.shift();
        }
        
        this.timers.set(name, timings);
        
        this.recordMetric({
            name,
            value: duration,
            timestamp: Date.now(),
            tags,
            type: 'timer'
        });
    }

    /**
     * Record histogram value
     */
    histogram(name: string, value: number, tags?: Record<string, string>): void {
        this.recordMetric({
            name,
            value,
            timestamp: Date.now(),
            tags,
            type: 'histogram'
        });
    }

    /**
     * Get current counter value
     */
    getCounter(name: string): number {
        return this.counters.get(name) || 0;
    }

    /**
     * Get current gauge value
     */
    getGauge(name: string): number {
        return this.gauges.get(name) || 0;
    }

    /**
     * Get timer statistics
     */
    getTimerStats(name: string): { count: number; min: number; max: number; avg: number; p95: number } | null {
        const timings = this.timers.get(name);
        if (!timings || timings.length === 0) {
            return null;
        }

        const sorted = [...timings].sort((a, b) => a - b);
        const count = sorted.length;
        const min = sorted[0];
        const max = sorted[count - 1];
        const avg = sorted.reduce((sum, val) => sum + val, 0) / count;
        const p95Index = Math.floor(count * 0.95);
        const p95 = sorted[p95Index];

        return { count, min, max, avg, p95 };
    }

    /**
     * Get all metrics summary
     */
    getSummary(): {
        counters: Record<string, number>;
        gauges: Record<string, number>;
        timers: Record<string, ReturnType<MetricsService['getTimerStats']>>;
        system: Record<string, any>;
    } {
        const counters: Record<string, number> = {};
        this.counters.forEach((value, key) => {
            counters[key] = value;
        });

        const gauges: Record<string, number> = {};
        this.gauges.forEach((value, key) => {
            gauges[key] = value;
        });

        const timers: Record<string, ReturnType<MetricsService['getTimerStats']>> = {};
        this.timers.forEach((_, key) => {
            timers[key] = this.getTimerStats(key);
        });

        // System metrics
        const memUsage = process.memoryUsage();
        const system = {
            uptime: process.uptime(),
            memory: {
                rss: Math.round(memUsage.rss / 1024 / 1024),
                heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
                heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
                external: Math.round(memUsage.external / 1024 / 1024)
            },
            cpu: process.cpuUsage(),
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch
        };

        return { counters, gauges, timers, system };
    }

    /**
     * Record a metric
     */
    private recordMetric(metric: MetricData): void {
        const existing = this.metrics.get(metric.name) || [];
        existing.push(metric);
        
        // Keep only last 100 entries per metric
        if (existing.length > 100) {
            existing.shift();
        }
        
        this.metrics.set(metric.name, existing);
    }

    /**
     * Create metrics middleware for HTTP requests
     */
    createHttpMetricsMiddleware() {
        return (req: any, res: any, next: () => void) => {
            const timer = this.timer('http.request.duration', {
                method: req.method || 'UNKNOWN',
                route: req.route || req.url || 'unknown'
            });

            this.increment('http.requests.total', 1, {
                method: req.method || 'UNKNOWN'
            });

            // Hook into response finish to record metrics
            const originalEnd = res.end;
            res.end = (...args: any[]) => {
                const duration = timer.stop();
                
                this.increment('http.responses.total', 1, {
                    method: req.method || 'UNKNOWN',
                    status: String(res.statusCode || 'unknown')
                });

                if (res.statusCode >= 400) {
                    this.increment('http.errors.total', 1, {
                        method: req.method || 'UNKNOWN',
                        status: String(res.statusCode)
                    });
                }

                this.logger.debug('HTTP request completed', {
                    method: req.method,
                    url: req.url,
                    statusCode: res.statusCode,
                    duration
                });

                return originalEnd.apply(res, args);
            };

            next();
        };
    }

    /**
     * Create metrics endpoint for monitoring
     */
    createMetricsEndpoint() {
        return async (req: any, res: any) => {
            try {
                const summary = this.getSummary();
                
                res.writeStatus('200 OK')
                   .writeHeader('Content-Type', 'application/json')
                   .end(JSON.stringify(summary, null, 2));
                   
            } catch (error) {
                res.writeStatus('500 Internal Server Error')
                   .writeHeader('Content-Type', 'application/json')
                   .end(JSON.stringify({
                       error: error instanceof Error ? error.message : String(error),
                       timestamp: new Date().toISOString()
                   }));
            }
        };
    }

    /**
     * Auto-collect system metrics
     */
    startSystemMetricsCollection(intervalMs: number = 30000): void {
        const collectMetrics = () => {
            const memUsage = process.memoryUsage();
            
            this.gauge('system.memory.rss', memUsage.rss);
            this.gauge('system.memory.heap_used', memUsage.heapUsed);
            this.gauge('system.memory.heap_total', memUsage.heapTotal);
            this.gauge('system.memory.external', memUsage.external);
            this.gauge('system.uptime', process.uptime());

            // CPU usage (requires previous measurement for comparison)
            const cpuUsage = process.cpuUsage();
            this.gauge('system.cpu.user', cpuUsage.user);
            this.gauge('system.cpu.system', cpuUsage.system);
        };

        // Collect immediately
        collectMetrics();
        
        // Then collect at intervals
        setInterval(collectMetrics, intervalMs);
    }

    /**
     * Clear all metrics
     */
    clear(): void {
        this.metrics.clear();
        this.counters.clear();
        this.gauges.clear();
        this.timers.clear();
        
        // Only log in development
        if (process.env.NODE_ENV === 'development') {
            this.logger.debug('All metrics cleared');
        }
    }

    /**
     * Export metrics in Prometheus format
     */
    exportPrometheus(): string {
        const lines: string[] = [];
        
        // Counters
        this.counters.forEach((value, name) => {
            lines.push(`# TYPE ${name} counter`);
            lines.push(`${name} ${value}`);
        });
        
        // Gauges
        this.gauges.forEach((value, name) => {
            lines.push(`# TYPE ${name} gauge`);
            lines.push(`${name} ${value}`);
        });
        
        // Timer summaries
        this.timers.forEach((_, name) => {
            const stats = this.getTimerStats(name);
            if (stats) {
                lines.push(`# TYPE ${name}_duration_seconds summary`);
                lines.push(`${name}_duration_seconds{quantile="0.95"} ${stats.p95 / 1000}`);
                lines.push(`${name}_duration_seconds_sum ${(stats.avg * stats.count) / 1000}`);
                lines.push(`${name}_duration_seconds_count ${stats.count}`);
            }
        });
        
        return lines.join('\n');
    }
}

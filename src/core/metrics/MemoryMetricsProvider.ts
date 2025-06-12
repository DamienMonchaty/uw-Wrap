/**
 * In-Memory Metrics Provider
 * Local metrics collection with basic aggregation
 */

import {
    IMetricsProvider,
    MetricData,
    TimerResult,
    HistogramData,
    MetricSummary,
    MetricsSnapshot
} from '../interfaces/IMetricsProvider';

interface InternalMetric {
    type: 'counter' | 'gauge' | 'histogram' | 'timer' | 'summary';
    value: number;
    tags?: Record<string, string>;
    lastUpdated: number;
    
    // Histogram specific
    buckets?: Map<number, number>;
    sum?: number;
    count?: number;
    
    // Timer specific
    measurements?: number[];
}

export class MemoryMetricsProvider implements IMetricsProvider {
    private metrics = new Map<string, InternalMetric>();
    private histogramBuckets = [0.1, 0.5, 1, 2.5, 5, 10, 25, 50, 100, 250, 500, 1000];

    increment(name: string, value: number = 1, tags?: Record<string, string>): void {
        const key = this.getMetricKey(name, tags);
        const existing = this.metrics.get(key);
        
        if (existing && existing.type === 'counter') {
            existing.value += value;
            existing.lastUpdated = Date.now();
        } else {
            this.metrics.set(key, {
                type: 'counter',
                value,
                tags,
                lastUpdated: Date.now()
            });
        }
    }

    decrement(name: string, value: number = 1, tags?: Record<string, string>): void {
        this.increment(name, -value, tags);
    }

    gauge(name: string, value: number, tags?: Record<string, string>): void {
        const key = this.getMetricKey(name, tags);
        
        this.metrics.set(key, {
            type: 'gauge',
            value,
            tags,
            lastUpdated: Date.now()
        });
    }

    histogram(name: string, value: number, tags?: Record<string, string>): void {
        const key = this.getMetricKey(name, tags);
        const existing = this.metrics.get(key);
        
        if (existing && existing.type === 'histogram') {
            existing.count = (existing.count || 0) + 1;
            existing.sum = (existing.sum || 0) + value;
            existing.lastUpdated = Date.now();
            
            // Update buckets
            if (!existing.buckets) {
                existing.buckets = new Map();
            }
            
            for (const bucket of this.histogramBuckets) {
                if (value <= bucket) {
                    const currentCount = existing.buckets.get(bucket) || 0;
                    existing.buckets.set(bucket, currentCount + 1);
                }
            }
        } else {
            const buckets = new Map<number, number>();
            for (const bucket of this.histogramBuckets) {
                buckets.set(bucket, value <= bucket ? 1 : 0);
            }
            
            this.metrics.set(key, {
                type: 'histogram',
                value,
                tags,
                lastUpdated: Date.now(),
                buckets,
                sum: value,
                count: 1
            });
        }
    }

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

    timing(name: string, duration: number, tags?: Record<string, string>): void {
        const key = this.getMetricKey(name, tags);
        const existing = this.metrics.get(key);
        
        if (existing && existing.type === 'timer') {
            if (!existing.measurements) {
                existing.measurements = [];
            }
            existing.measurements.push(duration);
            existing.value = this.calculateAverage(existing.measurements);
            existing.lastUpdated = Date.now();
            
            // Keep only last 1000 measurements to prevent memory bloat
            if (existing.measurements.length > 1000) {
                existing.measurements = existing.measurements.slice(-1000);
            }
        } else {
            this.metrics.set(key, {
                type: 'timer',
                value: duration,
                tags,
                lastUpdated: Date.now(),
                measurements: [duration]
            });
        }
    }

    async getSnapshot(): Promise<MetricsSnapshot> {
        const metrics: MetricSummary[] = [];
        
        for (const [key, metric] of this.metrics.entries()) {
            metrics.push(this.convertToSummary(key, metric));
        }
        
        return {
            timestamp: Date.now(),
            metrics,
            systemMetrics: {
                memoryUsage: process.memoryUsage(),
                cpuUsage: process.cpuUsage(),
                uptime: process.uptime(),
                processId: process.pid
            }
        };
    }

    async getMetric(name: string): Promise<MetricSummary | null> {
        for (const [key, metric] of this.metrics.entries()) {
            if (key.startsWith(name)) {
                return this.convertToSummary(key, metric);
            }
        }
        return null;
    }

    async getMetrics(pattern?: string): Promise<MetricSummary[]> {
        const metrics: MetricSummary[] = [];
        
        for (const [key, metric] of this.metrics.entries()) {
            if (!pattern || this.matchPattern(key, pattern)) {
                metrics.push(this.convertToSummary(key, metric));
            }
        }
        
        return metrics;
    }

    async reset(): Promise<void> {
        this.metrics.clear();
    }

    async resetMetric(name: string): Promise<boolean> {
        let found = false;
        const keysToDelete: string[] = [];
        
        for (const key of this.metrics.keys()) {
            if (key.startsWith(name)) {
                keysToDelete.push(key);
                found = true;
            }
        }
        
        keysToDelete.forEach(key => this.metrics.delete(key));
        return found;
    }

    async healthCheck(): Promise<{
        status: 'pass' | 'warn' | 'fail';
        message?: string;
        metricsCount: number;
    }> {
        const metricsCount = this.metrics.size;
        
        if (metricsCount > 10000) {
            return {
                status: 'warn',
                message: `High number of metrics: ${metricsCount}`,
                metricsCount
            };
        }
        
        return {
            status: 'pass',
            message: `Metrics system healthy (${metricsCount} metrics)`,
            metricsCount
        };
    }

    async shutdown(): Promise<void> {
        await this.reset();
    }

    private getMetricKey(name: string, tags?: Record<string, string>): string {
        if (!tags || Object.keys(tags).length === 0) {
            return name;
        }
        
        const sortedTags = Object.keys(tags)
            .sort()
            .map(key => `${key}=${tags[key]}`)
            .join(',');
            
        return `${name}{${sortedTags}}`;
    }

    private convertToSummary(key: string, metric: InternalMetric): MetricSummary {
        const name = key.includes('{') ? key.split('{')[0] : key;
        
        let value: number | HistogramData = metric.value;
        
        if (metric.type === 'histogram' && metric.buckets) {
            const buckets: Record<string, number> = {};
            for (const [bucket, count] of metric.buckets.entries()) {
                buckets[bucket.toString()] = count;
            }
            
            value = {
                count: metric.count || 0,
                sum: metric.sum || 0,
                buckets
            };
        }
        
        return {
            name,
            type: metric.type,
            value,
            tags: metric.tags,
            lastUpdated: metric.lastUpdated
        };
    }

    private calculateAverage(measurements: number[]): number {
        return measurements.reduce((sum, value) => sum + value, 0) / measurements.length;
    }

    private matchPattern(key: string, pattern: string): boolean {
        const regexPattern = pattern
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.');
        return new RegExp(`^${regexPattern}$`).test(key);
    }
}

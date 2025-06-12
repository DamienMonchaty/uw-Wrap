/**
 * Metrics Provider Interface - Implementation agnostic metrics collection
 * Supports multiple backends: Memory, Prometheus, StatsD, etc.
 */

export interface MetricData {
    name: string;
    value: number;
    timestamp: number;
    tags?: Record<string, string>;
    type: 'counter' | 'gauge' | 'histogram' | 'timer' | 'summary';
}

export interface TimerResult {
    stop: () => number;
}

export interface HistogramData {
    count: number;
    sum: number;
    buckets: Record<string, number>;
    quantiles?: Record<string, number>;
}

export interface MetricSummary {
    name: string;
    type: string;
    value: number | HistogramData;
    tags?: Record<string, string>;
    lastUpdated: number;
}

export interface MetricsSnapshot {
    timestamp: number;
    metrics: MetricSummary[];
    systemMetrics?: {
        memoryUsage: NodeJS.MemoryUsage;
        cpuUsage: NodeJS.CpuUsage;
        uptime: number;
        processId: number;
    };
}

/**
 * Abstract metrics provider interface
 * Implementations: MemoryMetricsProvider, PrometheusMetricsProvider, etc.
 */
export interface IMetricsProvider {
    /**
     * Increment a counter
     */
    increment(name: string, value?: number, tags?: Record<string, string>): void;
    
    /**
     * Decrement a counter
     */
    decrement(name: string, value?: number, tags?: Record<string, string>): void;
    
    /**
     * Set a gauge value
     */
    gauge(name: string, value: number, tags?: Record<string, string>): void;
    
    /**
     * Record a histogram value
     */
    histogram(name: string, value: number, tags?: Record<string, string>): void;
    
    /**
     * Start a timer
     */
    timer(name: string, tags?: Record<string, string>): TimerResult;
    
    /**
     * Record timing manually
     */
    timing(name: string, duration: number, tags?: Record<string, string>): void;
    
    /**
     * Get current metrics snapshot
     */
    getSnapshot(): Promise<MetricsSnapshot>;
    
    /**
     * Get specific metric
     */
    getMetric(name: string): Promise<MetricSummary | null>;
    
    /**
     * Get metrics by pattern
     */
    getMetrics(pattern?: string): Promise<MetricSummary[]>;
    
    /**
     * Reset all metrics
     */
    reset(): Promise<void>;
    
    /**
     * Reset specific metric
     */
    resetMetric(name: string): Promise<boolean>;
    
    /**
     * Health check for metrics system
     */
    healthCheck(): Promise<{
        status: 'pass' | 'warn' | 'fail';
        message?: string;
        metricsCount: number;
    }>;
    
    /**
     * Shutdown the metrics provider
     */
    shutdown(): Promise<void>;
}

/**
 * Metrics service configuration
 */
export interface MetricsServiceConfig {
    provider?: IMetricsProvider;
    enableSystemMetrics?: boolean;
    systemMetricsInterval?: number;
    enableHealthCheck?: boolean;
    defaultTags?: Record<string, string>;
}

/**
 * Metrics decorator options
 */
export interface MetricsDecoratorOptions {
    name?: string;
    tags?: Record<string, string>;
    type?: 'counter' | 'timer' | 'histogram';
    incrementOn?: 'call' | 'success' | 'error';
}

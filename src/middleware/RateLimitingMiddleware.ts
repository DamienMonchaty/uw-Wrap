/**
 * RateLimitingMiddleware - Implements rate limiting for HTTP requests
 * Single responsibility: Request rate limiting and throttling
 */

import { MiddlewareContext, NextFunction } from './MiddlewareContext';
import { Middleware } from './AuthenticationMiddleware';

export interface RateLimitOptions {
    /** Maximum number of requests per window */
    maxRequests: number;
    /** Time window in milliseconds */
    windowMs: number;
    /** Custom key generator function (defaults to IP-based) */
    keyGenerator?: (context: MiddlewareContext) => string;
    /** Custom error message */
    message?: string;
    /** Headers to include in response */
    standardHeaders?: boolean;
    /** Skip rate limiting for certain requests */
    skip?: (context: MiddlewareContext) => boolean;
}

interface RateLimitStore {
    [key: string]: {
        requests: number;
        resetTime: number;
    };
}

/**
 * Rate Limiting Middleware
 */
export class RateLimitingMiddleware extends Middleware {
    private store: RateLimitStore = {};
    private cleanupInterval?: NodeJS.Timeout;

    constructor(private options: RateLimitOptions) {
        super();
        
        // Set default values for missing options
        this.options = {
            ...{
                maxRequests: 100,
                windowMs: 15 * 60 * 1000, // 15 minutes
                message: 'Too many requests, please try again later.',
                standardHeaders: true
            },
            ...options
        };

        // Setup cleanup interval to remove expired entries
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, this.options.windowMs);
    }

    async execute(context: MiddlewareContext, next: NextFunction): Promise<void> {
        // Skip rate limiting if skip function returns true
        if (this.options.skip && this.options.skip(context)) {
            await next();
            return;
        }

        const key = this.generateKey(context);
        const now = Date.now();

        // Get or create rate limit entry
        let entry = this.store[key];
        if (!entry || entry.resetTime <= now) {
            entry = {
                requests: 0,
                resetTime: now + this.options.windowMs
            };
            this.store[key] = entry;
        }

        // Increment request count
        entry.requests++;

        // Add rate limit headers if enabled
        if (this.options.standardHeaders) {
            this.addRateLimitHeaders(context, entry);
        }

        // Check if rate limit exceeded
        if (entry.requests > this.options.maxRequests) {
            this.handleRateLimitExceeded(context);
            return; // Don't call next() - request is blocked
        }

        // Continue to next middleware
        await next();
    }

    /**
     * Generate rate limit key
     */
    private generateKey(context: MiddlewareContext): string {
        if (this.options.keyGenerator) {
            return this.options.keyGenerator(context);
        }

        // Default: use IP address from headers
        const forwarded = context.headers?.['x-forwarded-for'];
        const ip = forwarded || context.headers?.['x-real-ip'] || 'unknown';
        
        return `rateLimit:${ip}`;
    }

    /**
     * Add rate limit headers to response
     */
    private addRateLimitHeaders(context: MiddlewareContext, entry: { requests: number; resetTime: number }): void {
        const remaining = Math.max(0, this.options.maxRequests - entry.requests);
        const resetTime = Math.ceil(entry.resetTime / 1000);

        // Standard rate limit headers
        context.res.writeHeader('X-RateLimit-Limit', this.options.maxRequests.toString());
        context.res.writeHeader('X-RateLimit-Remaining', remaining.toString());
        context.res.writeHeader('X-RateLimit-Reset', resetTime.toString());
    }

    /**
     * Handle rate limit exceeded
     */
    private handleRateLimitExceeded(context: MiddlewareContext): void {
        context.res.writeStatus('429 Too Many Requests');
        context.res.writeHeader('Content-Type', 'application/json');
        context.res.writeHeader('Retry-After', Math.ceil(this.options.windowMs / 1000).toString());
        
        const response = {
            error: 'Rate limit exceeded',
            message: this.options.message,
            retryAfter: Math.ceil(this.options.windowMs / 1000)
        };

        context.res.end(JSON.stringify(response));
    }

    /**
     * Cleanup expired entries
     */
    private cleanup(): void {
        const now = Date.now();
        
        for (const [key, entry] of Object.entries(this.store)) {
            if (entry.resetTime <= now) {
                delete this.store[key];
            }
        }
    }

    /**
     * Cleanup on shutdown
     */
    destroy(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = undefined;
        }
        this.store = {};
    }
}

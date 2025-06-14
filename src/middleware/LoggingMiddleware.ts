/**
 * LoggingMiddleware - Logs HTTP requests and responses
 * Single responsibility: Request/Response logging
 */

import { MiddlewareContext, NextFunction } from './MiddlewareContext';
import { Middleware } from './AuthenticationMiddleware';
import { Logger } from '../utils/logger';

export interface LoggingOptions {
    /** Log request details */
    logRequests?: boolean;
    /** Log response details */
    logResponses?: boolean;
    /** Log request body (be careful with sensitive data) */
    logRequestBody?: boolean;
    /** Headers to exclude from logging */
    excludeHeaders?: string[];
    /** Paths to exclude from logging */
    excludePaths?: string[];
}

/**
 * Logging Middleware for HTTP requests and responses
 */
export class LoggingMiddleware extends Middleware {
    
    constructor(
        private logger: Logger,
        private options: LoggingOptions = {}
    ) {
        super();
        
        // Default options
        this.options = {
            logRequests: true,
            logResponses: false,
            logRequestBody: false,
            excludeHeaders: ['authorization', 'cookie'],
            excludePaths: ['/health', '/metrics'],
            ...options
        };
    }

    async execute(context: MiddlewareContext, next: NextFunction): Promise<void> {
        const startTime = Date.now();
        
        // Check if path should be excluded
        if (this.shouldExcludePath(context.url)) {
            await next();
            return;
        }

        // Log request
        if (this.options.logRequests) {
            this.logRequest(context);
        }

        // Execute next middleware/handler
        await next();

        // Log response
        if (this.options.logResponses) {
            const duration = Date.now() - startTime;
            this.logResponse(context, duration);
        }
    }

    /**
     * Log incoming request
     */
    private logRequest(context: MiddlewareContext): void {
        const logData: Record<string, unknown> = {
            method: context.method,
            url: context.url,
            query: context.query,
            headers: this.filterHeaders(context.headers || {}),
            timestamp: new Date().toISOString()
        };

        // Add body if enabled and present
        if (this.options.logRequestBody && context.body) {
            logData.body = context.body;
        }

        this.logger.info(`[REQUEST] ${context.method?.toUpperCase()} ${context.url}`, logData);
    }

    /**
     * Log response
     */
    private logResponse(context: MiddlewareContext, duration: number): void {
        const logData = {
            method: context.method,
            url: context.url,
            duration: `${duration}ms`,
            timestamp: new Date().toISOString()
        };

        this.logger.info(`[RESPONSE] ${context.method?.toUpperCase()} ${context.url} - ${duration}ms`, logData);
    }

    /**
     * Filter sensitive headers
     */
    private filterHeaders(headers: Record<string, string>): Record<string, string> {
        const filtered: Record<string, string> = {};
        const excludeHeaders = this.options.excludeHeaders || [];

        for (const [key, value] of Object.entries(headers)) {
            if (!excludeHeaders.includes(key.toLowerCase())) {
                filtered[key] = value;
            } else {
                filtered[key] = '[FILTERED]';
            }
        }

        return filtered;
    }

    /**
     * Check if path should be excluded from logging
     */
    private shouldExcludePath(url?: string): boolean {
        if (!url || !this.options.excludePaths) {
            return false;
        }

        return this.options.excludePaths.some(path => url.startsWith(path));
    }
}

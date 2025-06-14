/**
 * Separated CORS Middleware
 * Single responsibility: Handle CORS headers and preflight requests
 */

import { MiddlewareContext, NextFunction } from './MiddlewareContext';
import { Middleware } from './AuthenticationMiddleware';

export interface CorsOptions {
    origin?: string | string[] | ((origin: string) => boolean);
    methods?: string[];
    allowedHeaders?: string[];
    exposedHeaders?: string[];
    credentials?: boolean;
    maxAge?: number;
    preflightContinue?: boolean;
}

/**
 * CORS Middleware - Single responsibility: CORS handling
 */
export class CorsMiddleware extends Middleware {
    
    constructor(private options: CorsOptions = {}) {
        super();
    }

    async execute(context: MiddlewareContext, next: NextFunction): Promise<void> {
        // Set CORS headers
        this.setCorsHeaders(context);
        
        // Handle preflight requests
        if (context.method?.toLowerCase() === 'options') {
            this.handlePreflight(context);
            return;
        }
        
        await next();
    }

    private setCorsHeaders(context: MiddlewareContext): void {
        const { res, headers } = context;
        
        // Handle origin
        const origin = this.getOrigin(headers?.['origin'] || '');
        if (origin) {
            res.writeHeader('Access-Control-Allow-Origin', origin);
        }

        // Set methods
        const methods = this.options.methods || ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];
        res.writeHeader('Access-Control-Allow-Methods', methods.join(', '));

        // Set allowed headers
        const allowedHeaders = this.options.allowedHeaders || [
            'Content-Type', 
            'Authorization', 
            'X-Requested-With',
            'Accept',
            'Origin'
        ];
        res.writeHeader('Access-Control-Allow-Headers', allowedHeaders.join(', '));

        // Set exposed headers
        if (this.options.exposedHeaders && this.options.exposedHeaders.length > 0) {
            res.writeHeader('Access-Control-Expose-Headers', this.options.exposedHeaders.join(', '));
        }

        // Set credentials
        if (this.options.credentials) {
            res.writeHeader('Access-Control-Allow-Credentials', 'true');
        }

        // Set max age for preflight cache
        if (this.options.maxAge) {
            res.writeHeader('Access-Control-Max-Age', this.options.maxAge.toString());
        }
    }

    private getOrigin(requestOrigin: string): string | null {
        const { origin } = this.options;

        if (!origin) {
            return '*';
        }

        if (typeof origin === 'string') {
            return origin;
        }

        if (Array.isArray(origin)) {
            return origin.includes(requestOrigin) ? requestOrigin : null;
        }

        if (typeof origin === 'function') {
            return origin(requestOrigin) ? requestOrigin : null;
        }

        return null;
    }

    private handlePreflight(context: MiddlewareContext): void {
        context.res.writeStatus('204 No Content');
        context.res.end();
    }
}

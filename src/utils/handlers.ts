/**
 * HTTP Request/Response Handler Utilities
 * Pure functions for common HTTP operations
 */

import { HttpRequest, HttpResponse, EnhancedHttpRequest } from '../types/uws-types';

/**
 * HTTP handler utility functions
 */
export class HttpHandlerUtils {
    /**
     * Parse request body from HTTP request
     */
    static async parseRequestBody(
        req: HttpRequest | EnhancedHttpRequest,
        res: HttpResponse
    ): Promise<Record<string, unknown>> {
        return new Promise((resolve, reject) => {
            let buffer = Buffer.alloc(0);

            res.onData((chunk, isLast) => {
                buffer = Buffer.concat([buffer, Buffer.from(chunk)]);
                
                if (isLast) {
                    try {
                        const bodyText = buffer.toString('utf8');
                        const body = bodyText ? JSON.parse(bodyText) as Record<string, unknown> : {};
                        resolve(body);
                    } catch (error) {
                        reject(new Error('Invalid JSON in request body'));
                    }
                }
            });

            res.onAborted(() => {
                reject(new Error('Request aborted'));
            });
        });
    }

    /**
     * Extract path parameters from URL
     */
    static extractPathParams(
        url: string,
        routePattern: string
    ): Record<string, string> {
        const params: Record<string, string> = {};
        
        const routeParts = routePattern.split('/');
        const urlParts = url.split('/');
        
        for (let i = 0; i < routeParts.length; i++) {
            const routePart = routeParts[i];
            if (routePart.startsWith(':')) {
                const paramName = routePart.substring(1);
                params[paramName] = urlParts[i] || '';
            }
        }
        
        return params;
    }

    /**
     * Extract query parameters from request
     */
    static extractQueryParams(req: HttpRequest | EnhancedHttpRequest): Record<string, string> {
        const params: Record<string, string> = {};
        
        try {
            const query = (req as any).getQuery?.() || '';
            if (query) {
                const pairs = query.split('&');
                for (const pair of pairs) {
                    const [key, value] = pair.split('=');
                    if (key) {
                        params[decodeURIComponent(key)] = decodeURIComponent(value || '');
                    }
                }
            }
        } catch (error) {
            // Ignore query parsing errors
        }
        
        return params;
    }

    /**
     * Extract headers from request
     */
    static extractHeaders(req: HttpRequest | EnhancedHttpRequest): Record<string, string> {
        const headers: Record<string, string> = {};
        
        try {
            const commonHeaders = [
                'authorization',
                'content-type',
                'user-agent',
                'accept',
                'x-forwarded-for',
                'x-real-ip',
                'host',
                'origin',
                'referer'
            ];
            
            for (const header of commonHeaders) {
                const value = (req as HttpRequest).getHeader?.(header);
                if (value) {
                    headers[header] = value;
                }
            }
        } catch (error) {
            // Ignore header extraction errors
        }
        
        return headers;
    }

    /**
     * Create standardized success response
     */
    static createSuccessResponse<T>(
        data: T,
        message?: string,
        meta?: Record<string, unknown>
    ): {
        success: boolean;
        data: T;
        message?: string;
        meta?: Record<string, unknown>;
        timestamp: string;
    } {
        return {
            success: true,
            data,
            message,
            meta,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Create standardized error response
     */
    static createErrorResponse(
        message: string,
        code?: string,
        details?: Record<string, unknown>
    ): {
        success: boolean;
        error: {
            message: string;
            code?: string;
            details?: Record<string, unknown>;
        };
        timestamp: string;
    } {
        return {
            success: false,
            error: {
                message,
                code,
                details
            },
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Validate required fields in request body
     */
    static validateRequiredFields(
        body: Record<string, unknown>,
        requiredFields: string[]
    ): { valid: boolean; missing: string[] } {
        const missing: string[] = [];
        
        for (const field of requiredFields) {
            if (body[field] === undefined || body[field] === null || body[field] === '') {
                missing.push(field);
            }
        }
        
        return {
            valid: missing.length === 0,
            missing
        };
    }

    /**
     * Sanitize input data
     */
    static sanitizeInput(input: unknown): unknown {
        if (typeof input === 'string') {
            return input.trim().replace(/[<>]/g, '');
        }
        
        if (Array.isArray(input)) {
            return input.map(item => HttpHandlerUtils.sanitizeInput(item));
        }
        
        if (typeof input === 'object' && input !== null) {
            const sanitized: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(input)) {
                sanitized[key] = HttpHandlerUtils.sanitizeInput(value);
            }
            return sanitized;
        }
        
        return input;
    }

    /**
     * Generate request ID for tracking
     */
    static generateRequestId(): string {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get client IP address
     */
    static getClientIP(req: HttpRequest | EnhancedHttpRequest): string {
        const headers = HttpHandlerUtils.extractHeaders(req);
        return headers['x-forwarded-for'] || 
               headers['x-real-ip'] || 
               'unknown';
    }

    /**
     * Check if request is JSON content type
     */
    static isJsonRequest(req: HttpRequest | EnhancedHttpRequest): boolean {
        const headers = HttpHandlerUtils.extractHeaders(req);
        const contentType = headers['content-type'] || '';
        return contentType.includes('application/json');
    }

    /**
     * Create async error handler wrapper
     */
    static asyncHandler(
        handler: (req: HttpRequest, res: HttpResponse, ...args: unknown[]) => Promise<unknown>,
        errorHandler: (error: Error, context: string) => unknown,
        context: string
    ) {
        return async (req: HttpRequest, res: HttpResponse, ...args: unknown[]) => {
            try {
                return await handler(req, res, ...args);
            } catch (error) {
                return errorHandler(error as Error, context);
            }
        };
    }
}

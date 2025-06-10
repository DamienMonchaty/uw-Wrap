/**
 * Enhanced middleware system for uW-Wrap
 * Provides extensible middleware pipeline with context passing
 */

export interface MiddlewareContext {
    req: any;
    res: any;
    user?: any;
    data?: Record<string, any>;
    params?: Record<string, string>;
    query?: Record<string, string>;
    body?: any;
    headers?: Record<string, string>;
    method?: string; // Add HTTP method to avoid accessing req after async
    url?: string; // Add URL to avoid accessing req after async
}

export interface NextFunction {
    (): Promise<void>;
}

export abstract class Middleware {
    abstract execute(context: MiddlewareContext, next: NextFunction): Promise<void>;
}

/**
 * CORS Middleware
 */
export class CorsMiddleware extends Middleware {
    constructor(
        private options: {
            origin?: string | string[];
            methods?: string[];
            allowedHeaders?: string[];
            credentials?: boolean;
        } = {}
    ) {
        super();
    }

    async execute(context: MiddlewareContext, next: NextFunction): Promise<void> {
        const { res } = context;
        
        // Set CORS headers
        const origin = this.options.origin || '*';
        const methods = this.options.methods || ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];
        const allowedHeaders = this.options.allowedHeaders || ['Content-Type', 'Authorization'];
        
        res.writeHeader('Access-Control-Allow-Origin', Array.isArray(origin) ? origin.join(',') : origin);
        res.writeHeader('Access-Control-Allow-Methods', methods.join(','));
        res.writeHeader('Access-Control-Allow-Headers', allowedHeaders.join(','));
        
        if (this.options.credentials) {
            res.writeHeader('Access-Control-Allow-Credentials', 'true');
        }
        
        // Handle preflight requests
        if (context.method === 'options') {
            res.writeStatus('200 OK').end();
            return;
        }
        
        await next();
    }
}

/**
 * Logging Middleware
 */
export class LoggingMiddleware extends Middleware {
    constructor(private logger: any) {
        super();
    }

    async execute(context: MiddlewareContext, next: NextFunction): Promise<void> {
        const start = Date.now();
        const method = (context.method || 'unknown').toUpperCase();
        const url = context.url || 'unknown';
        
        // Only log in development or for errors
        if (process.env.NODE_ENV === 'development') {
            this.logger.debug(`${method} ${url} - Started`);
        }
        
        try {
            await next();
            const duration = Date.now() - start;
            
            // Only log slow requests in production
            if (process.env.NODE_ENV === 'development' || duration > 1000) {
                this.logger.info(`${method} ${url} - Completed in ${duration}ms`);
            }
        } catch (error) {
            const duration = Date.now() - start;
            this.logger.error(`${method} ${url} - Error in ${duration}ms:`, {});
            throw error;
        }
    }
}

/**
 * Authentication Middleware
 */
export class AuthenticationMiddleware extends Middleware {
    constructor(
        private jwtManager: any,
        private options: { roles?: string[] } = {},
        private logger?: any
    ) {
        super();
    }

    async execute(context: MiddlewareContext, next: NextFunction): Promise<void> {
        const authHeader = context.headers?.['authorization'] || '';
        
        // Debug logging with both console and logger
        const debugInfo = {
            url: context.url,
            method: context.method,
            headersAvailable: Object.keys(context.headers || {}),
            hasAuthHeader: !!authHeader,
            authHeaderStart: authHeader ? authHeader.substring(0, 20) : 'NONE',
            requiredRoles: this.options.roles
        };
        
        console.log(`[AUTH DEBUG] Request:`, debugInfo);
        if (this.logger) {
            this.logger.debug('[AUTH DEBUG] Authentication middleware:', debugInfo);
        }
        
        if (!authHeader.startsWith('Bearer ')) {
            console.log(`[AUTH DEBUG] Invalid auth header format - got:`, authHeader);
            if (this.logger) {
                this.logger.debug('[AUTH DEBUG] Invalid auth header format', { authHeader });
            }
            throw new Error('Missing or invalid authorization header');
        }
        
        const token = authHeader.substring(7);
        
        // JWT verification and role checking (authentication phase)
        // Do NOT wrap next() in try-catch - let business logic errors pass through
        try {
            // Synchronous token verification to avoid async issues
            const decoded = this.jwtManager.verifyToken(token);
            console.log(`[AUTH DEBUG] Token verified successfully for user:`, decoded.userId);
            if (this.logger) {
                this.logger.debug('[AUTH DEBUG] Token verified successfully', { userId: decoded.userId, role: decoded.role });
            }
            console.log(`[AUTH DEBUG] User token data:`, decoded);
            context.user = decoded;
            
            // Check roles if specified
            if (this.options.roles && this.options.roles.length > 0) {
                // Handle both 'role' (string) and 'roles' (array) formats
                const userRoles = decoded.roles || (decoded.role ? [decoded.role] : []);
                console.log(`[AUTH DEBUG] User roles:`, userRoles);
                console.log(`[AUTH DEBUG] Required roles:`, this.options.roles);
                if (this.logger) {
                    this.logger.debug('[AUTH DEBUG] Role check', { userRoles, requiredRoles: this.options.roles });
                }
                const hasRequiredRole = this.options.roles.some(role => userRoles.includes(role));
                console.log(`[AUTH DEBUG] Has required role:`, hasRequiredRole);
                
                if (!hasRequiredRole) {
                    console.log(`[AUTH DEBUG] Permission denied - insufficient roles`);
                    if (this.logger) {
                        this.logger.debug('[AUTH DEBUG] Permission denied - insufficient roles');
                    }
                    throw new Error('Insufficient permissions');
                }
            }
            
            console.log(`[AUTH DEBUG] Authentication successful, proceeding to next middleware`);
            if (this.logger) {
                this.logger.debug('[AUTH DEBUG] Authentication successful, proceeding to next middleware');
            }
        } catch (error) {
            console.log(`[AUTH DEBUG] JWT verification error:`, error);
            if (this.logger) {
                this.logger.error('[AUTH DEBUG] JWT verification error:', error);
            }
            // Only handle JWT verification and permission errors
            if (error instanceof Error) {
                const errorMessage = error.message;
                
                // Re-throw specific permission errors as-is
                if (errorMessage === 'Insufficient permissions') {
                    throw error;
                }
                
                // Re-throw JWT verification errors with normalized message
                if (errorMessage.includes('Token expired') || 
                    errorMessage.includes('Invalid token') ||
                    errorMessage.includes('jwt malformed') ||
                    errorMessage.includes('jwt signature') ||
                    errorMessage.includes('jwt not active') ||
                    errorMessage.includes('jwt audience invalid') ||
                    errorMessage.includes('jwt issuer invalid') ||
                    errorMessage.includes('jwt id invalid') ||
                    errorMessage.includes('jwt subject invalid')) {
                    throw new Error('Invalid or expired token');
                }
            }
            
            // For unknown errors during JWT verification, wrap with generic auth error
            throw new Error('Invalid or expired token');
        }
        
        // Authentication successful, continue to next middleware/handler
        // Do NOT wrap this in try-catch - let business logic errors pass through unchanged
        await next();
    }
}

/**
 * Validation Middleware
 */
export class ValidationMiddleware extends Middleware {
    constructor(private schema: any) {
        super();
    }

    async execute(context: MiddlewareContext, next: NextFunction): Promise<void> {
        const method = context.method?.toLowerCase();
        
        if (!context.body && (method === 'post' || method === 'put' || method === 'patch')) {
            // Read body if not already read
            const bodyBuffer = await this.readBody(context.res);
            try {
                context.body = JSON.parse(bodyBuffer);
            } catch (error) {
                throw new Error('Invalid JSON in request body');
            }
        }
        
        if (context.body) {
            const result = this.validateData(context.body, this.schema);
            if (!result.valid) {
                throw new Error(`Validation failed: ${result.errors.join(', ')}`);
            }
        }
        
        await next();
    }
    
    private async readBody(res: any): Promise<string> {
        return new Promise((resolve, reject) => {
            let buffer = '';
            res.onData((chunk: ArrayBuffer, isLast: boolean) => {
                buffer += Buffer.from(chunk).toString();
                if (isLast) {
                    resolve(buffer);
                }
            });
            res.onAborted(() => {
                reject(new Error('Request aborted'));
            });
        });
    }
    
    private validateData(data: any, schema: any): { valid: boolean; errors: string[] } {
        const errors: string[] = [];
        
        // Basic validation implementation
        if (schema.required) {
            for (const field of schema.required) {
                if (!(field in data) || data[field] === null || data[field] === undefined) {
                    errors.push(`Field '${field}' is required`);
                }
            }
        }
        
        if (schema.properties) {
            for (const [field, fieldSchema] of Object.entries(schema.properties)) {
                if (field in data) {
                    const fieldErrors = this.validateField(data[field], fieldSchema as any, field);
                    errors.push(...fieldErrors);
                }
            }
        }
        
        return { valid: errors.length === 0, errors };
    }
    
    private validateField(value: any, schema: any, fieldName: string): string[] {
        const errors: string[] = [];
        
        if (schema.type && typeof value !== schema.type) {
            errors.push(`Field '${fieldName}' must be of type ${schema.type}`);
        }
        
        if (schema.minLength && value.length < schema.minLength) {
            errors.push(`Field '${fieldName}' must be at least ${schema.minLength} characters long`);
        }
        
        if (schema.maxLength && value.length > schema.maxLength) {
            errors.push(`Field '${fieldName}' must be at most ${schema.maxLength} characters long`);
        }
        
        if (schema.enum && !schema.enum.includes(value)) {
            errors.push(`Field '${fieldName}' must be one of: ${schema.enum.join(', ')}`);
        }
        
        if (schema.format === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            errors.push(`Field '${fieldName}' must be a valid email address`);
        }
        
        return errors;
    }
}

/**
 * Rate Limiting Middleware
 */
export class RateLimitingMiddleware extends Middleware {
    private requests = new Map<string, { count: number; resetTime: number }>();
    
    constructor(
        private options: {
            maxRequests: number;
            windowMs: number;
            keyGenerator?: (context: MiddlewareContext) => string;
        }
    ) {
        super();
    }

    async execute(context: MiddlewareContext, next: NextFunction): Promise<void> {
        const key = this.options.keyGenerator 
            ? this.options.keyGenerator(context)
            : this.getClientKey(context);
        
        const now = Date.now();
        const record = this.requests.get(key);
        
        if (!record || now > record.resetTime) {
            // New window
            this.requests.set(key, {
                count: 1,
                resetTime: now + this.options.windowMs
            });
        } else {
            // Existing window
            record.count++;
            
            if (record.count > this.options.maxRequests) {
                throw new Error('Rate limit exceeded');
            }
        }
        
        await next();
    }
    
    private getClientKey(context: MiddlewareContext): string {
        // Simple IP-based key (in production, you might want to use a more sophisticated approach)
        return context.headers?.['x-forwarded-for'] || 
               context.headers?.['x-real-ip'] || 
               'unknown';
    }
}

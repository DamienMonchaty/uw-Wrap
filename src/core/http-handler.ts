import { UWebSocketWrapper } from './server-wrapper';
import { Logger } from '../utils/logger';
import { ErrorHandler } from '../utils/errorHandler';
import { HttpRequest, HttpResponse, EnhancedHttpRequest } from '../types/uws-types';

/**
 * Base handler class with common functionality for route handling
 * This provides a foundation for creating organized, modular route handlers
 */
export abstract class BaseHandler {
    protected server: UWebSocketWrapper;
    protected logger: Logger;
    protected errorHandler: ErrorHandler;

    constructor(
        server: UWebSocketWrapper,
        logger: Logger,
        errorHandler: ErrorHandler
    ) {
        this.server = server;
        this.logger = logger;
        this.errorHandler = errorHandler;
    }

    /**
     * Register all routes for this handler
     * This method must be implemented by each handler to define its routes
     */
    abstract registerRoutes(): void;

    /**
     * Helper method to handle async route errors consistently
     * Wraps async route handlers with try-catch and proper error handling
     */
    protected async handleAsync(
        req: any,
        res: any,
        handler: (req: any, res: any) => Promise<void>,
        context: string
    ): Promise<void> {
        // Generate request ID for tracking
        const requestId = this.generateRequestId();
        
        try {
            await handler(req, res);
        } catch (error) {
            const { response: errorResponse, statusCode } = this.errorHandler.handleError(error as Error, context, requestId);
            
            this.server.sendJSON(res, errorResponse, statusCode);
        }
    }

    /**
     * Generate a unique request ID for tracking
     */
    private generateRequestId(): string {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get parsed JSON body from request (if available from Enhanced Router)
     * Falls back to manual parsing if not available
     */
    protected getRequestBody(req: HttpRequest | EnhancedHttpRequest, res?: HttpResponse): any {
        // Check if Enhanced Router has already parsed the body
        if ((req as EnhancedHttpRequest).body !== undefined) {
            return (req as EnhancedHttpRequest).body;
        }
        
        // Return empty object if no body available to prevent destructuring errors
        return {};
    }

    /**
     * Get parsed JSON body with async fallback
     */
    protected async getRequestBodyAsync(req: HttpRequest | EnhancedHttpRequest, res: HttpResponse): Promise<any> {
        // Check if Enhanced Router has already parsed the body
        if ((req as EnhancedHttpRequest).body !== undefined) {
            return (req as EnhancedHttpRequest).body;
        }
        
        // Fall back to manual parsing
        return this.parseJsonBodyManual(res);
    }

    /**
     * Parse JSON body safely with error handling (legacy method)
     */
    protected async parseJsonBody(res: any): Promise<any> {
        return this.parseJsonBodyManual(res);
    }

    /**
     * Manual JSON body parsing (for cases where Enhanced Router didn't parse it)
     */
    private async parseJsonBodyManual(res: any): Promise<any> {
        try {
            const body = await this.server.readBody(res);
            return JSON.parse(body);
        } catch (error) {
            throw new Error('Invalid JSON in request body');
        }
    }

    /**
     * Send success response with consistent format
     */
    protected sendSuccess(res: HttpResponse, data: any, message?: string): void {
        const response = message ? { message, ...data } : data;
        this.server.sendJSON(res, response);
    }

    /**
     * Send error response with consistent format
     */
    protected sendError(res: HttpResponse, message: string, statusCode: number = 400): void {
        this.server.sendJSON(res, { error: message }, statusCode);
    }

    /**
     * Extract query parameters from request
     */
    protected getQueryParams(req: HttpRequest | EnhancedHttpRequest): Record<string, string> {
        try {
            const query = req.getQuery();
            const params: Record<string, string> = {};
            
            if (query) {
                const searchParams = new URLSearchParams(query);
                for (const [key, value] of searchParams.entries()) {
                    params[key] = value;
                }
            }
            
            return params;
        } catch (error) {
            return {};
        }
    }

    /**
     * Extract path parameters from request
     */
    protected getPathParams(req: HttpRequest | EnhancedHttpRequest): Record<string, string> {
        try {
            // Check if Enhanced Router has already parsed the params
            if ((req as EnhancedHttpRequest).params !== undefined) {
                return (req as EnhancedHttpRequest).params || {};
            }
            
            // For uWS, parameters are accessed by index, not as an object
            // This would need to be implemented by the router that knows the route pattern
            return {};
        } catch (error) {
            return {};
        }
    }

    /**
     * Validate required fields in request body
     */
    protected validateRequiredFields(data: any, requiredFields: string[]): void {
        const missingFields = requiredFields.filter(field => !data[field]);
        if (missingFields.length > 0) {
            this.createValidationError(`Missing required fields: ${missingFields.join(', ')}`, missingFields.join(','));
        }
    }

    /**
     * Helper methods for creating specific errors
     */
    protected createValidationError(message: string, field?: string, value?: any): never {
        throw this.errorHandler.createValidationError(message, field, value);
    }

    protected createNotFoundError(resource: string, id?: string): never {
        throw this.errorHandler.createNotFoundError(resource, id);
    }

    protected createUnauthorizedError(message?: string): never {
        throw this.errorHandler.createAuthenticationError(message);
    }

    protected createForbiddenError(message?: string, resource?: string): never {
        throw this.errorHandler.createAuthorizationError(message, resource);
    }

    protected createConflictError(message: string, resource?: string): never {
        throw this.errorHandler.createConflictError(message, resource);
    }

    protected createBusinessRuleError(message: string, rule?: string): never {
        throw this.errorHandler.createBusinessRuleError(message, rule);
    }
}

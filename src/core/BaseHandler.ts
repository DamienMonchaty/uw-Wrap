import { UWebSocketWrapper } from './uWebSocketWrapper';
import { Logger } from '../utils/logger';
import { ErrorHandler } from '../utils/errorHandler';

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
     * Parse JSON body safely with error handling
     */
    protected async parseJsonBody(res: any): Promise<any> {
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
    protected sendSuccess(res: any, data: any, message?: string): void {
        const response = message ? { message, ...data } : data;
        this.server.sendJSON(res, response);
    }

    /**
     * Send error response with consistent format
     */
    protected sendError(res: any, message: string, statusCode: number = 400): void {
        this.server.sendJSON(res, { error: message }, statusCode);
    }

    /**
     * Extract query parameters from request
     */
    protected getQueryParams(req: any): Record<string, string> {
        const query = req.getQuery();
        const params: Record<string, string> = {};
        
        if (query) {
            const searchParams = new URLSearchParams(query);
            for (const [key, value] of searchParams.entries()) {
                params[key] = value;
            }
        }
        
        return params;
    }

    /**
     * Extract path parameters from request
     */
    protected getPathParams(req: any): Record<string, string> {
        return req.getParameters ? req.getParameters() : {};
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

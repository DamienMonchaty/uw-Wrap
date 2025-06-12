import { UWebSocketWrapper } from './ServerWrapper';
import { Logger } from '../utils/logger';
import { ErrorHandler } from '../utils/errorHandler';
import { HttpHandlerUtils } from '../utils/handlers';
import { HttpRequest, HttpResponse } from '../types/uws-types';
import { MiddlewareContext } from '../middleware/AuthenticationMiddleware';

/**
 * Base handler class with modern architecture
 * Single Responsibility: Base functionality for HTTP handlers
 * All deprecated methods have been removed
 */
export abstract class HttpHandler {
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
     * Modern handler method for use with new Router system
     * Uses MiddlewareContext for cleaner interface
     */
    protected async handleWithContext(
        context: MiddlewareContext,
        handler: (context: MiddlewareContext) => Promise<void>
    ): Promise<void> {
        try {
            await handler(context);
        } catch (error) {
            const requestId = context.requestId || this.generateRequestId();
            const { response: errorResponse, statusCode } = this.errorHandler.handleError(
                error as Error, 
                'HttpHandler', 
                requestId
            );
            this.server.sendJSON(context.res as unknown as HttpResponse, errorResponse, statusCode);
        }
    }

    // =============================================================================
    // MODERN UTILITY METHODS - Using HttpHandlerUtils
    // =============================================================================

    /**
     * Get parsed JSON body from request
     * Uses HttpHandlerUtils for consistent parsing
     */
    protected async getRequestBody(context: MiddlewareContext): Promise<Record<string, unknown>> {
        return await HttpHandlerUtils.parseRequestBody(context.req as unknown as HttpRequest, context.res as unknown as HttpResponse);
    }

    /**
     * Send success response with consistent format
     * Uses HttpHandlerUtils for standardized responses
     */
    protected sendSuccess(context: MiddlewareContext, data: Record<string, unknown> | unknown[], message?: string): void {
        const response = HttpHandlerUtils.createSuccessResponse(data, message);
        this.server.sendJSON(context.res as unknown as HttpResponse, response);
    }

    /**
     * Send error response with consistent format
     * Uses HttpHandlerUtils for standardized responses
     */
    protected sendError(context: MiddlewareContext, message: string, statusCode: number = 400): void {
        const response = HttpHandlerUtils.createErrorResponse(message);
        this.server.sendJSON(context.res as unknown as HttpResponse, response, statusCode);
    }

    /**
     * Extract query parameters from request
     * Uses HttpHandlerUtils for consistent extraction
     */
    protected getQueryParams(context: MiddlewareContext): Record<string, string> {
        return HttpHandlerUtils.extractQueryParams(context.req as unknown as HttpRequest);
    }

    /**
     * Extract path parameters from request
     * Uses HttpHandlerUtils for consistent extraction
     */
    protected getPathParams(context: MiddlewareContext, routePattern?: string): Record<string, string> {
        if (!routePattern) {
            // Si pas de pattern fourni, retourner un objet vide ou extraire depuis l'URL
            return {};
        }
        const url = context.url || '';
        return HttpHandlerUtils.extractPathParams(url, routePattern);
    }

    /**
     * Validate required fields in request body
     * Uses HttpHandlerUtils for consistent validation
     */
    protected validateRequiredFields(data: Record<string, unknown>, fields: string[]): void {
        HttpHandlerUtils.validateRequiredFields(data, fields);
    }

    /**
     * Log request with consistent format
     */
    protected logRequest(context: MiddlewareContext, additionalData?: Record<string, unknown>): void {
        const method = context.method || 'UNKNOWN';
        const url = context.url || 'unknown';
        const userAgent = context.headers?.['user-agent'] || 'unknown';
        const ip = this.getClientIP(context);
        
        this.logger.info(`${method} ${url}`, {
            ip,
            userAgent,
            requestId: context.requestId,
            ...additionalData
        });
    }

    /**
     * Check if request is authenticated
     */
    protected isAuthenticated(context: MiddlewareContext): boolean {
        return !!(context as any).user;
    }

    /**
     * Get authenticated user from context
     */
    protected getUser(context: MiddlewareContext): any {
        return (context as any).user;
    }

    /**
     * Get user roles from context
     */
    protected getUserRoles(context: MiddlewareContext): string[] {
        const user = this.getUser(context);
        return user?.roles || [];
    }

    /**
     * Check if user has required role
     */
    protected hasRole(context: MiddlewareContext, role: string): boolean {
        const roles = this.getUserRoles(context);
        return roles.includes(role);
    }

    /**
     * Check if user has any of the required roles
     */
    protected hasAnyRole(context: MiddlewareContext, roles: string[]): boolean {
        const userRoles = this.getUserRoles(context);
        return roles.some(role => userRoles.includes(role));
    }

    /**
     * Get request IP address
     */
    protected getClientIP(context: MiddlewareContext): string {
        // Essayer d'abord les headers de proxy
        const forwarded = context.headers?.['x-forwarded-for'];
        if (forwarded) {
            return forwarded.split(',')[0].trim();
        }
        
        const realIp = context.headers?.['x-real-ip'];
        if (realIp) {
            return realIp;
        }
        
        // Fallback vers l'IP de connexion directe ou valeur par défaut
        return context.headers?.['remote-addr'] || 'unknown';
    }

    /**
     * Get user agent from request
     */
    protected getUserAgent(context: MiddlewareContext): string {
        return context.headers?.['user-agent'] || 'unknown';
    }

    /**
     * Generate a unique request ID for tracking
     */
    private generateRequestId(): string {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }
}

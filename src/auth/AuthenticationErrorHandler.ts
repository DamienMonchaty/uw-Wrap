/**
 * AuthenticationErrorHandler - Single responsibility: Authentication error handling
 * Extracted from AuthenticationMiddleware for better separation of concerns
 */

import { Logger } from '../types/middleware.types';

export interface AuthError {
    type: 'AUTHENTICATION' | 'AUTHORIZATION' | 'VALIDATION';
    code: string;
    message: string;
    details?: Record<string, unknown>;
    statusCode: number;
}

export interface ErrorContext {
    url?: string;
    method?: string;
    userId?: number;
    userRoles?: string[];
    requiredRoles?: string[];
    timestamp: string;
    [key: string]: unknown;
}

/**
 * Authentication Error Handler - Handles auth-specific errors
 */
export class AuthenticationErrorHandler {
    
    constructor(private logger?: Logger) {}

    /**
     * Create authentication error
     */
    createAuthenticationError(
        code: string, 
        message: string, 
        details?: Record<string, unknown>
    ): AuthError {
        return {
            type: 'AUTHENTICATION',
            code,
            message,
            details,
            statusCode: 401
        };
    }

    /**
     * Create authorization error
     */
    createAuthorizationError(
        code: string, 
        message: string, 
        details?: Record<string, unknown>
    ): AuthError {
        return {
            type: 'AUTHORIZATION',
            code,
            message,
            details,
            statusCode: 403
        };
    }

    /**
     * Create validation error
     */
    createValidationError(
        code: string, 
        message: string, 
        details?: Record<string, unknown>
    ): AuthError {
        return {
            type: 'VALIDATION',
            code,
            message,
            details,
            statusCode: 400
        };
    }

    /**
     * Handle JWT verification errors
     */
    handleJwtError(
        jwtResult: { success: boolean; error?: string; errorType?: string },
        context: ErrorContext
    ): AuthError {
        const errorDetails = {
            ...context,
            jwtErrorType: jwtResult.errorType
        };

        switch (jwtResult.errorType) {
            case 'EXPIRED':
                this.logAuthEvent('JWT_EXPIRED', { ...context });
                return this.createAuthenticationError(
                    'TOKEN_EXPIRED',
                    'Authentication token has expired',
                    errorDetails
                );

            case 'MALFORMED':
                this.logAuthEvent('JWT_MALFORMED', { ...context });
                return this.createAuthenticationError(
                    'TOKEN_MALFORMED',
                    'Authentication token is malformed',
                    errorDetails
                );

            case 'INVALID':
                this.logAuthEvent('JWT_INVALID', { ...context });
                return this.createAuthenticationError(
                    'TOKEN_INVALID',
                    'Authentication token is invalid',
                    errorDetails
                );

            case 'MISSING':
                this.logAuthEvent('JWT_MISSING', { ...context });
                return this.createAuthenticationError(
                    'TOKEN_MISSING',
                    'Authentication token is required',
                    errorDetails
                );

            default:
                this.logAuthEvent('JWT_UNKNOWN_ERROR', { ...context });
                return this.createAuthenticationError(
                    'TOKEN_ERROR',
                    'Authentication failed',
                    errorDetails
                );
        }
    }

    /**
     * Handle role authorization errors
     */
    handleRoleError(
        roleCheckResult: {
            hasPermission: boolean;
            userRoles: string[];
            requiredRoles: string[];
            missingRoles?: string[];
        },
        context: ErrorContext
    ): AuthError {
        const errorDetails = {
            ...context,
            userRoles: roleCheckResult.userRoles,
            requiredRoles: roleCheckResult.requiredRoles,
            missingRoles: roleCheckResult.missingRoles
        };

        this.logAuthEvent('INSUFFICIENT_PERMISSIONS', errorDetails);

        return this.createAuthorizationError(
            'INSUFFICIENT_PERMISSIONS',
            `Access denied. Required roles: ${roleCheckResult.requiredRoles.join(', ')}`,
            errorDetails
        );
    }

    /**
     * Handle missing authorization header
     */
    handleMissingAuthHeader(context: ErrorContext): AuthError {
        this.logAuthEvent('MISSING_AUTH_HEADER', { ...context });
        
        return this.createAuthenticationError(
            'MISSING_AUTH_HEADER',
            'Authorization header is required',
            context
        );
    }

    /**
     * Handle invalid authorization header format
     */
    handleInvalidAuthHeader(authHeader: string, context: ErrorContext): AuthError {
        const errorDetails = {
            ...context,
            authHeaderFormat: authHeader?.substring(0, 20) || 'NONE'
        };

        this.logAuthEvent('INVALID_AUTH_HEADER', errorDetails);
        
        return this.createAuthenticationError(
            'INVALID_AUTH_HEADER',
            'Invalid authorization header format. Expected "Bearer <token>"',
            errorDetails
        );
    }

    /**
     * Convert AuthError to HTTP response format
     */
    toHttpResponse(error: AuthError): {
        status: number;
        body: {
            success: false;
            error: {
                type: string;
                code: string;
                message: string;
                timestamp: string;
            };
        };
    } {
        return {
            status: error.statusCode,
            body: {
                success: false,
                error: {
                    type: error.type,
                    code: error.code,
                    message: error.message,
                    timestamp: new Date().toISOString()
                }
            }
        };
    }

    /**
     * Log authentication events for monitoring
     */
    private logAuthEvent(event: string, context: ErrorContext | Record<string, unknown>): void {
        const logData = {
            event,
            ...context,
            timestamp: new Date().toISOString()
        };

        // Console logging for development
        if (process.env.NODE_ENV === 'development') {
            console.log(`[AUTH EVENT] ${event}:`, logData);
        }

        // Structured logging if logger is available
        if (this.logger) {
            this.logger.warn(`Authentication event: ${event}`, logData);
        }
    }

    /**
     * Check if error is an authentication error
     */
    isAuthError(error: unknown): error is AuthError {
        return error !== null && 
               typeof error === 'object' && 
               'type' in error &&
               ['AUTHENTICATION', 'AUTHORIZATION', 'VALIDATION'].includes((error as AuthError).type);
    }

    /**
     * Log successful authentication for monitoring
     */
    logAuthSuccess(context: ErrorContext): void {
        this.logAuthEvent('AUTH_SUCCESS', { ...context });
    }
}

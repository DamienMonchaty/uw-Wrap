/**
 * Refactored Authentication Middleware
 * Now uses dependency injection and follows single responsibility principle
 */

import { JwtService, JwtPayload } from '../auth/JwtService';
import { UserRoleService, User } from '../auth/UserRoleService';
import { AuthenticationErrorHandler, ErrorContext } from '../auth/AuthenticationErrorHandler';
import { MiddlewareContext, NextFunction } from './MiddlewareContext';
import { 
    Logger,
    HttpError,
    AuthenticationOptions
} from '../types/middleware.types';

export abstract class Middleware {
    abstract execute(context: MiddlewareContext, next: NextFunction): Promise<void>;
}

/**
 * Refactored Authentication Middleware
 * Single responsibility: Coordinate JWT verification and role checking using injected services
 */
export class AuthenticationMiddleware extends Middleware {
    
    constructor(
        private jwtService: JwtService,
        private userRoleService: UserRoleService,
        private errorHandler: AuthenticationErrorHandler,
        private options: AuthenticationOptions = {}
    ) {
        super();
    }

    async execute(context: MiddlewareContext, next: NextFunction): Promise<void> {
        try {
            // If auth is not required, skip authentication
            if (this.options.requireAuth === false) {
                await next();
                return;
            }

            // Extract and validate token
            const user = await this.authenticateUser(context);
            
            // Check roles if specified
            if (this.options.roles && this.options.roles.length > 0) {
                this.authorizeUser(user, context);
            }

            // Set user in context
            context.user = user;

            // Log successful authentication
            this.errorHandler.logAuthSuccess({
                url: context.url,
                method: context.method,
                userId: user.userId,
                userRoles: this.userRoleService.getUserRoles(user),
                timestamp: new Date().toISOString()
            });

            // Continue to next middleware
            await next();

        } catch (error) {
            this.handleAuthenticationError(error, context);
        }
    }

    /**
     * Authenticate user using JWT token
     */
    private async authenticateUser(context: MiddlewareContext): Promise<User> {
        const authHeader = context.headers?.['authorization'] || '';
        
        // Extract token from header
        const tokenResult = this.jwtService.extractTokenFromHeader(authHeader);
        if (!tokenResult.success) {
            if (!authHeader) {
                throw this.errorHandler.handleMissingAuthHeader(this.getErrorContext(context));
            } else {
                throw this.errorHandler.handleInvalidAuthHeader(authHeader, this.getErrorContext(context));
            }
        }

        // Verify JWT token
        const jwtResult = this.jwtService.verifyToken(tokenResult.token!);
        if (!jwtResult.success) {
            throw this.errorHandler.handleJwtError(jwtResult, this.getErrorContext(context));
        }

        // Convert JWT payload to User
        return this.jwtPayloadToUser(jwtResult.payload!);
    }

    /**
     * Authorize user based on roles
     */
    private authorizeUser(user: User, context: MiddlewareContext): void {
        const requiredRoles = this.options.roles!;
        
        // Check roles using role service
        const roleCheckResult = this.options.checkAllRoles 
            ? this.userRoleService.hasAllRoles(user, requiredRoles)
            : this.userRoleService.hasAnyRole(user, requiredRoles);

        if (!roleCheckResult.hasPermission) {
            throw this.errorHandler.handleRoleError(roleCheckResult, this.getErrorContext(context, user));
        }
    }

    /**
     * Convert JWT payload to User object
     */
    private jwtPayloadToUser(payload: JwtPayload): User {
        return {
            userId: payload.userId,
            email: payload.email,
            role: payload.role,
            roles: payload.roles,
            permissions: Array.isArray(payload.permissions) ? payload.permissions : undefined
        };
    }

    /**
     * Create error context for logging
     */
    private getErrorContext(context: MiddlewareContext, user?: User): ErrorContext {
        return {
            url: context.url,
            method: context.method,
            userId: user?.userId,
            userRoles: user ? this.userRoleService.getUserRoles(user) : undefined,
            requiredRoles: this.options.roles,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Handle authentication errors
     */
    private handleAuthenticationError(error: unknown, context: MiddlewareContext): never {
        // If it's already an AuthError, convert to HTTP response and throw
        if (this.errorHandler.isAuthError(error)) {
            const httpResponse = this.errorHandler.toHttpResponse(error);
            
            // Write HTTP response
            context.res.writeStatus(`${httpResponse.status} ${this.getStatusText(httpResponse.status)}`);
            context.res.writeHeader('Content-Type', 'application/json');
            context.res.end(JSON.stringify(httpResponse.body));
            throw error;
        }

        // Handle unknown errors
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const authError = this.errorHandler.createAuthenticationError(
            'UNKNOWN_AUTH_ERROR',
            'Authentication failed due to an unknown error',
            { originalError: errorMessage }
        );

        const httpResponse = this.errorHandler.toHttpResponse(authError);
        context.res.writeStatus(`${httpResponse.status} ${this.getStatusText(httpResponse.status)}`);
        context.res.writeHeader('Content-Type', 'application/json');
        context.res.end(JSON.stringify(httpResponse.body));
        throw authError;
    }

    /**
     * Get HTTP status text
     */
    private getStatusText(statusCode: number): string {
        const statusTexts: Record<number, string> = {
            400: 'Bad Request',
            401: 'Unauthorized',
            403: 'Forbidden',
            500: 'Internal Server Error'
        };
        return statusTexts[statusCode] || 'Unknown';
    }
}

/**
 * Factory function to create authentication middleware with default dependencies
 */
export function createAuthenticationMiddleware(
    jwtSecret: string,
    options: { 
        roles?: string[];
        requireAuth?: boolean;
        checkAllRoles?: boolean;
    } = {},
    logger?: Logger
): AuthenticationMiddleware {
    const jwtService = new JwtService(jwtSecret);
    const userRoleService = new UserRoleService();
    const errorHandler = new AuthenticationErrorHandler(logger);
    
    return new AuthenticationMiddleware(jwtService, userRoleService, errorHandler, options);
}

/**
 * Convenience functions for common authentication patterns
 */
export const AuthMiddleware = {
    /**
     * Require authentication but no specific roles
     */
    requireAuth(jwtSecret: string, logger?: Logger): AuthenticationMiddleware {
        return createAuthenticationMiddleware(jwtSecret, { requireAuth: true }, logger);
    },

    /**
     * Require admin role
     */
    requireAdmin(jwtSecret: string, logger?: Logger): AuthenticationMiddleware {
        return createAuthenticationMiddleware(jwtSecret, { 
            requireAuth: true, 
            roles: ['admin'] 
        }, logger);
    },

    /**
     * Require moderator or admin role
     */
    requireModerator(jwtSecret: string, logger?: Logger): AuthenticationMiddleware {
        return createAuthenticationMiddleware(jwtSecret, { 
            requireAuth: true, 
            roles: ['moderator', 'admin'] 
        }, logger);
    },

    /**
     * Require any of the specified roles
     */
    requireAnyRole(roles: string[], jwtSecret: string, logger?: Logger): AuthenticationMiddleware {
        return createAuthenticationMiddleware(jwtSecret, { 
            requireAuth: true, 
            roles,
            checkAllRoles: false
        }, logger);
    },

    /**
     * Require all of the specified roles
     */
    requireAllRoles(roles: string[], jwtSecret: string, logger?: Logger): AuthenticationMiddleware {
        return createAuthenticationMiddleware(jwtSecret, { 
            requireAuth: true, 
            roles,
            checkAllRoles: true
        }, logger);
    },

    /**
     * Optional authentication (sets user if token is present but doesn't require it)
     */
    optionalAuth(jwtSecret: string, logger?: Logger): AuthenticationMiddleware {
        return createAuthenticationMiddleware(jwtSecret, { requireAuth: false }, logger);
    }
};

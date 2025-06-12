/**
 * AuthenticationWrapper - Manages JWT authentication for HTTP handlers
 * Single Responsibility: Authentication and authorization
 */

import * as uWS from 'uWebSockets.js';
import { HttpHandler } from '../../types';
import { Logger } from '../../utils/logger';
import { ErrorHandler } from '../../utils/errorHandler';
import { JWTManager } from '../../auth/JwtManager';

export interface AuthenticatedRequest extends uWS.HttpRequest {
    user?: any;
}

export interface AuthenticationOptions {
    /** Skip authentication for specific routes */
    skipPaths?: string[];
    /** Custom token extractor */
    tokenExtractor?: (req: uWS.HttpRequest) => string | null;
    /** Custom user info extractor from JWT payload */
    userExtractor?: (payload: any) => any;
}

/**
 * Authentication Wrapper - Handles JWT authentication
 */
export class AuthenticationWrapper {
    private jwtManager: JWTManager;
    private logger: Logger;
    private errorHandler: ErrorHandler;
    private options: AuthenticationOptions;

    constructor(
        jwtManager: JWTManager,
        logger: Logger,
        errorHandler: ErrorHandler,
        options: AuthenticationOptions = {}
    ) {
        this.jwtManager = jwtManager;
        this.logger = logger;
        this.errorHandler = errorHandler;
        this.options = {
            skipPaths: [],
            ...options
        };
    }

    /**
     * Wrap handler with authentication
     */
    requireAuth(handler: HttpHandler): HttpHandler {
        return (req: uWS.HttpRequest, res: uWS.HttpResponse) => {
            try {
                // Check if path should skip authentication
                const url = req.getUrl();
                if (this.shouldSkipAuth(url)) {
                    return handler(req, res);
                }

                // Extract token
                const token = this.extractToken(req);
                if (!token) {
                    return this.sendAuthError(res, 'No authorization token provided');
                }

                // Verify token
                const payload = this.jwtManager.verifyToken(token);
                
                // Extract user info
                const user = this.options.userExtractor 
                    ? this.options.userExtractor(payload)
                    : payload;

                // Add user to request
                (req as AuthenticatedRequest).user = user;

                // Log successful authentication
                this.logger.debug('Authentication successful', {
                    userId: user.id || user.sub,
                    url: req.getUrl()
                });

                // Call original handler
                return handler(req, res);

            } catch (error) {
                this.logger.warn('Authentication failed', {
                    url: req.getUrl(),
                    error: (error as Error).message
                });
                
                return this.sendAuthError(res, (error as Error).message);
            }
        };
    }

    /**
     * Create optional authentication wrapper
     */
    optionalAuth(handler: HttpHandler): HttpHandler {
        return (req: uWS.HttpRequest, res: uWS.HttpResponse) => {
            try {
                const token = this.extractToken(req);
                
                if (token) {
                    try {
                        const payload = this.jwtManager.verifyToken(token);
                        const user = this.options.userExtractor 
                            ? this.options.userExtractor(payload)
                            : payload;
                        
                        (req as AuthenticatedRequest).user = user;
                    } catch (authError) {
                        // Ignore auth errors for optional auth
                        this.logger.debug('Optional auth failed', {
                            error: (authError as Error).message
                        });
                    }
                }

                return handler(req, res);

            } catch (error) {
                // For optional auth, continue without user info
                return handler(req, res);
            }
        };
    }

    /**
     * Extract token from request
     */
    private extractToken(req: uWS.HttpRequest): string | null {
        if (this.options.tokenExtractor) {
            return this.options.tokenExtractor(req);
        }

        const authHeader = req.getHeader('authorization');
        if (!authHeader) {
            return null;
        }

        return this.jwtManager.extractTokenFromHeader(authHeader);
    }

    /**
     * Check if authentication should be skipped for a path
     */
    private shouldSkipAuth(path: string): boolean {
        return this.options.skipPaths?.some(skipPath => {
            if (skipPath.includes('*')) {
                // Simple wildcard matching
                const regex = new RegExp(skipPath.replace(/\*/g, '.*'));
                return regex.test(path);
            }
            return path === skipPath;
        }) || false;
    }

    /**
     * Send authentication error response
     */
    private sendAuthError(res: uWS.HttpResponse, message: string): void {
        if (res.aborted) return;

        const error = this.errorHandler.createAuthenticationError(message);
        const { response: errorResponse, statusCode } = this.errorHandler.handleError(error, 'Authentication');

        try {
            res.cork(() => {
                if (!res.aborted) {
                    res.writeStatus(`${statusCode} Unauthorized`);
                    res.writeHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify(errorResponse));
                }
            });
        } catch (sendError) {
            this.logger.error('Failed to send auth error response:', sendError);
        }
    }

    /**
     * Update authentication options
     */
    updateOptions(newOptions: Partial<AuthenticationOptions>): void {
        this.options = { ...this.options, ...newOptions };
    }

    /**
     * Add skip path
     */
    addSkipPath(path: string): void {
        if (!this.options.skipPaths) {
            this.options.skipPaths = [];
        }
        this.options.skipPaths.push(path);
    }

    /**
     * Remove skip path
     */
    removeSkipPath(path: string): void {
        if (this.options.skipPaths) {
            const index = this.options.skipPaths.indexOf(path);
            if (index > -1) {
                this.options.skipPaths.splice(index, 1);
            }
        }
    }

    /**
     * Get current options
     */
    getOptions(): AuthenticationOptions {
        return { ...this.options };
    }
}

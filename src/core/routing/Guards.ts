/**
 * Route Guards - provides route protection and access control
 * Following Single Responsibility Principle - only route protection logic
 */

import { MiddlewareContext } from '../../middleware/MiddlewareContext';
import { Logger } from '../../utils/logger';

export interface GuardContext extends MiddlewareContext {
    user?: any;
    permissions?: string[];
    metadata?: any;
}

export interface Guard {
    /**
     * Check if the request should be allowed
     * @param context - Guard context
     * @returns Promise<boolean> - true if allowed, false if denied
     */
    canActivate(context: GuardContext): Promise<boolean>;
    
    /**
     * Optional method to customize the error response
     * @param context - Guard context
     * @param reason - Reason for denial
     */
    handleDenied?(context: GuardContext, reason?: string): void;
}

export class GuardManager {
    private globalGuards: Guard[] = [];
    private namedGuards: Map<string, Guard> = new Map();
    private logger: Logger;

    constructor(logger: Logger) {
        this.logger = logger;
        this.setupDefaultGuards();
    }

    /**
     * Setup default guards
     */
    private setupDefaultGuards(): void {
        this.registerGuard('authenticated', new AuthenticatedGuard());
        this.registerGuard('admin', new AdminGuard());
        this.registerGuard('owner', new OwnershipGuard());
    }

    /**
     * Add a global guard that applies to all routes
     */
    addGlobalGuard(guard: Guard): void {
        this.globalGuards.push(guard);
    }

    /**
     * Register a named guard
     */
    registerGuard(name: string, guard: Guard): void {
        this.namedGuards.set(name, guard);
    }

    /**
     * Get a guard by name
     */
    getGuard(name: string): Guard | undefined {
        return this.namedGuards.get(name);
    }

    /**
     * Execute guards for a route
     */
    async executeGuards(
        context: GuardContext,
        guardNames: string[] = []
    ): Promise<boolean> {
        // Execute global guards first
        for (const guard of this.globalGuards) {
            const canActivate = await this.executeGuard(guard, context);
            if (!canActivate) {
                return false;
            }
        }

        // Execute specific guards
        for (const guardName of guardNames) {
            const guard = this.namedGuards.get(guardName);
            if (guard) {
                const canActivate = await this.executeGuard(guard, context);
                if (!canActivate) {
                    return false;
                }
            } else {
                this.logger.warn(`Guard '${guardName}' not found`);
            }
        }

        return true;
    }

    /**
     * Execute a single guard
     */
    private async executeGuard(guard: Guard, context: GuardContext): Promise<boolean> {
        try {
            const canActivate = await guard.canActivate(context);
            
            if (!canActivate) {
                if (guard.handleDenied) {
                    guard.handleDenied(context);
                } else {
                    this.sendDefaultDeniedResponse(context);
                }
            }

            return canActivate;
        } catch (error) {
            this.logger.error('Guard execution failed:', error);
            this.sendErrorResponse(context, 'Guard execution failed');
            return false;
        }
    }

    /**
     * Send default denied response
     */
    private sendDefaultDeniedResponse(context: GuardContext): void {
        try {
            context.res
                .writeStatus('403 Forbidden')
                .writeHeader('Content-Type', 'application/json')
                .end(JSON.stringify({
                    error: 'Forbidden',
                    message: 'Access denied'
                }));
        } catch (error) {
            this.logger.warn('Failed to send denied response:', error);
        }
    }

    /**
     * Send error response
     */
    private sendErrorResponse(context: GuardContext, message: string): void {
        try {
            context.res
                .writeStatus('500 Internal Server Error')
                .writeHeader('Content-Type', 'application/json')
                .end(JSON.stringify({
                    error: 'Internal Server Error',
                    message
                }));
        } catch (error) {
            this.logger.warn('Failed to send error response:', error);
        }
    }

    /**
     * Get guard statistics
     */
    getStats(): {
        globalGuardCount: number;
        namedGuardCount: number;
        registeredGuards: string[];
    } {
        return {
            globalGuardCount: this.globalGuards.length,
            namedGuardCount: this.namedGuards.size,
            registeredGuards: Array.from(this.namedGuards.keys())
        };
    }
}

// =============================================================================
// DEFAULT GUARDS
// =============================================================================

/**
 * Authenticated Guard - ensures user is authenticated
 */
export class AuthenticatedGuard implements Guard {
    async canActivate(context: GuardContext): Promise<boolean> {
        return !!context.user;
    }

    handleDenied(context: GuardContext): void {
        try {
            context.res
                .writeStatus('401 Unauthorized')
                .writeHeader('Content-Type', 'application/json')
                .end(JSON.stringify({
                    error: 'Unauthorized',
                    message: 'Authentication required'
                }));
        } catch (error) {
            // Response might already be closed
        }
    }
}

/**
 * Admin Guard - ensures user has admin role
 */
export class AdminGuard implements Guard {
    async canActivate(context: GuardContext): Promise<boolean> {
        return context.user?.roles?.includes('admin') || context.user?.role === 'admin';
    }

    handleDenied(context: GuardContext): void {
        try {
            context.res
                .writeStatus('403 Forbidden')
                .writeHeader('Content-Type', 'application/json')
                .end(JSON.stringify({
                    error: 'Forbidden',
                    message: 'Admin access required'
                }));
        } catch (error) {
            // Response might already be closed
        }
    }
}

/**
 * Ownership Guard - ensures user owns the resource
 */
export class OwnershipGuard implements Guard {
    async canActivate(context: GuardContext): Promise<boolean> {
        const userId = context.user?.id;
        const resourceUserId = context.metadata?.userId || context.metadata?.ownerId;
        
        // Admin can access any resource
        if (context.user?.roles?.includes('admin')) {
            return true;
        }

        return userId && resourceUserId && userId.toString() === resourceUserId.toString();
    }

    handleDenied(context: GuardContext): void {
        try {
            context.res
                .writeStatus('403 Forbidden')
                .writeHeader('Content-Type', 'application/json')
                .end(JSON.stringify({
                    error: 'Forbidden',
                    message: 'You can only access your own resources'
                }));
        } catch (error) {
            // Response might already be closed
        }
    }
}

/**
 * Permission Guard - checks specific permissions
 */
export class PermissionGuard implements Guard {
    constructor(private requiredPermissions: string[]) {}

    async canActivate(context: GuardContext): Promise<boolean> {
        const userPermissions = context.permissions || context.user?.permissions || [];
        
        return this.requiredPermissions.every(permission => 
            userPermissions.includes(permission)
        );
    }

    handleDenied(context: GuardContext): void {
        try {
            context.res
                .writeStatus('403 Forbidden')
                .writeHeader('Content-Type', 'application/json')
                .end(JSON.stringify({
                    error: 'Forbidden',
                    message: `Required permissions: ${this.requiredPermissions.join(', ')}`
                }));
        } catch (error) {
            // Response might already be closed
        }
    }
}

/**
 * Authentication decorators
 * Following Single Responsibility Principle - only authentication-related decorators
 */

import { MetadataUtils } from './MetadataUtils';
import { AuthOptions } from './types';

// =============================================================================
// AUTHENTICATION DECORATORS
// =============================================================================

/**
 * Authentication decorator
 * Requires authentication for the decorated route
 * @param roles - Optional roles required for access
 * @example @Auth() or @Auth(['admin', 'user']) or @Auth('admin')
 */
export function Auth(roles?: string[] | string): MethodDecorator {
    return function (target: any, propertyKey: string | symbol | undefined, descriptor?: PropertyDescriptor) {
        const key = propertyKey as string;
        
        const options: AuthOptions = {
            roles: Array.isArray(roles) ? roles : roles ? [roles] : []
        };

        MetadataUtils.addMiddleware(target, key, {
            type: 'auth',
            options
        });
    };
}

/**
 * Requires admin role for the decorated route
 * Convenience decorator for common admin-only routes
 * @example @RequireAdmin()
 */
export function RequireAdmin(): MethodDecorator {
    return Auth(['admin']);
}

/**
 * Requires specific roles for the decorated route
 * @param roles - Array of required roles
 * @example @RequireRoles(['admin', 'moderator'])
 */
export function RequireRoles(roles: string[]): MethodDecorator {
    return Auth(roles);
}

/**
 * Public route decorator (no authentication required)
 * Explicitly marks a route as public for documentation purposes
 * @example @Public()
 */
export function Public(): MethodDecorator {
    return function (target: any, propertyKey: string | symbol | undefined, descriptor?: PropertyDescriptor) {
        // This is mainly for documentation and explicit marking
        // No middleware is added as no auth is required
        return descriptor;
    };
}

/**
 * Require user role decorator
 * Shorthand for @Auth(['user'])
 * @example @RequireUser()
 */
export function RequireUser(): MethodDecorator {
    return Auth(['user']);
}

/**
 * Require moderator role decorator
 * Shorthand for @Auth(['moderator'])
 * @example @RequireModerator()
 */
export function RequireModerator(): MethodDecorator {
    return Auth(['moderator']);
}

/**
 * Require authentication but allow any role
 * @example @RequireAuth()
 */
export function RequireAuth(): MethodDecorator {
    return Auth();
}

/**
 * Require specific permission decorator
 * @param permissions - Array of required permissions
 * @example @RequirePermissions(['read:users', 'write:users'])
 */
export function RequirePermissions(permissions: string[]): MethodDecorator {
    return function (target: any, propertyKey: string | symbol | undefined, descriptor?: PropertyDescriptor) {
        const key = propertyKey as string;
        
        MetadataUtils.addMiddleware(target, key, {
            type: 'auth',
            options: {
                permissions,
                roles: []
            }
        });
    };
}

/**
 * Require ownership decorator
 * User must own the resource they're trying to access
 * @param resourceIdParam - Name of the parameter containing the resource ID
 * @example @RequireOwnership('userId') or @RequireOwnership('id')
 */
export function RequireOwnership(resourceIdParam: string = 'id'): MethodDecorator {
    return function (target: any, propertyKey: string | symbol | undefined, descriptor?: PropertyDescriptor) {
        const key = propertyKey as string;
        
        MetadataUtils.addMiddleware(target, key, {
            type: 'auth',
            options: {
                ownership: true,
                resourceIdParam,
                roles: []
            }
        });
    };
}

/**
 * Require API key decorator
 * Validates API key instead of JWT token
 * @param keyHeader - Header name for API key (default: 'x-api-key')
 * @example @RequireApiKey() or @RequireApiKey('authorization')
 */
export function RequireApiKey(keyHeader: string = 'x-api-key'): MethodDecorator {
    return function (target: any, propertyKey: string | symbol | undefined, descriptor?: PropertyDescriptor) {
        const key = propertyKey as string;
        
        MetadataUtils.addMiddleware(target, key, {
            type: 'auth',
            options: {
                apiKey: true,
                keyHeader,
                roles: []
            }
        });
    };
}

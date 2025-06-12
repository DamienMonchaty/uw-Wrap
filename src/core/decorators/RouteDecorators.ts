/**
 * Route decorators for HTTP methods and class routing
 * Following Single Responsibility Principle - only route definition decorators
 */

import { MetadataUtils } from './MetadataUtils';
import { ClassMetadata } from './types';

// =============================================================================
// CLASS DECORATORS
// =============================================================================

/**
 * Route class decorator for setting base path and class-level middleware
 * @param basePath - Base path for all routes in this class
 */
export function Route(basePath?: string): ClassDecorator {
    return function <T extends Function>(target: T) {
        const metadata: ClassMetadata = {
            basePath: basePath || '',
            middlewares: []
        };
        MetadataUtils.setClassMetadata(target, metadata);
        return target;
    };
}

// =============================================================================
// METHOD DECORATORS - HTTP ROUTES
// =============================================================================

/**
 * HTTP method decorator factory
 * Creates decorators for different HTTP methods
 */
function createMethodDecorator(method: string) {
    return function (path: string = ''): MethodDecorator {
        return function (target: any, propertyKey: string | symbol | undefined, descriptor?: PropertyDescriptor) {
            const key = propertyKey as string;
            MetadataUtils.addRoute(target, key, method, path);
        };
    };
}

/**
 * GET route decorator
 * @param path - Route path (optional, defaults to empty string)
 * @example @GET('/users') or @GET()
 */
export const GET = createMethodDecorator('get');

/**
 * POST route decorator
 * @param path - Route path (optional, defaults to empty string)
 * @example @POST('/users') or @POST()
 */
export const POST = createMethodDecorator('post');

/**
 * PUT route decorator
 * @param path - Route path (optional, defaults to empty string)
 * @example @PUT('/users/:id') or @PUT()
 */
export const PUT = createMethodDecorator('put');

/**
 * DELETE route decorator
 * @param path - Route path (optional, defaults to empty string)
 * @example @DELETE('/users/:id') or @DELETE()
 */
export const DELETE = createMethodDecorator('delete');

/**
 * PATCH route decorator
 * @param path - Route path (optional, defaults to empty string)
 * @example @PATCH('/users/:id') or @PATCH()
 */
export const PATCH = createMethodDecorator('patch');

/**
 * Decorator-based routing system for uW-Wrap
 * Provides clean, declarative route definition with automatic middleware integration
 */

import 'reflect-metadata';

// Types for route metadata
export interface RouteMetadata {
    method: 'get' | 'post' | 'put' | 'delete' | 'patch';
    path: string;
    middlewares: MiddlewareMetadata[];
    handler: string;
}

export interface MiddlewareMetadata {
    type: 'auth' | 'validate' | 'rateLimit' | 'cors';
    options?: any;
}

export interface ClassMetadata {
    basePath?: string;
    middlewares: MiddlewareMetadata[];
}

// Metadata keys
const ROUTES_KEY = Symbol('routes');
const MIDDLEWARES_KEY = Symbol('middlewares');
const CLASS_METADATA_KEY = Symbol('classMetadata');

/**
 * Helper function to add middleware metadata to a method
 */
function addMiddleware(target: any, propertyKey: string, middleware: MiddlewareMetadata): void {
    const existingMiddlewares = Reflect.getMetadata(MIDDLEWARES_KEY, target, propertyKey) || [];
    existingMiddlewares.push(middleware);
    Reflect.defineMetadata(MIDDLEWARES_KEY, existingMiddlewares, target, propertyKey);
}

/**
 * Helper function to add route metadata to a method
 */
function addRoute(target: any, propertyKey: string, method: string, path: string): void {
    // Store the route info temporarily, we'll resolve middlewares later
    const route = {
        method: method as any,
        path,
        handler: propertyKey,
        target: target,
        propertyKey: propertyKey
    };

    const existingRoutes = Reflect.getMetadata(ROUTES_KEY, target.constructor) || [];
    existingRoutes.push(route);
    Reflect.defineMetadata(ROUTES_KEY, existingRoutes, target.constructor);
}

// =============================================================================
// CLASS DECORATORS
// =============================================================================

/**
 * Route class decorator for setting base path and class-level middleware
 */
export function Route(basePath?: string): ClassDecorator {
    return function <T extends Function>(target: T) {
        const metadata: ClassMetadata = {
            basePath: basePath || '',
            middlewares: []
        };
        Reflect.defineMetadata(CLASS_METADATA_KEY, metadata, target);
        return target;
    };
}

// =============================================================================
// METHOD DECORATORS - MIDDLEWARE
// =============================================================================

/**
 * Authentication decorator
 */
export function Auth(roles?: string[] | string): MethodDecorator {
    return function (target: any, propertyKey: string | symbol | undefined, descriptor?: PropertyDescriptor) {
        const key = propertyKey as string;
        addMiddleware(target, key, {
            type: 'auth',
            options: { roles: Array.isArray(roles) ? roles : roles ? [roles] : [] }
        });
    };
}

/**
 * Validation decorator
 */
export function Validate(schema: any): MethodDecorator {
    return function (target: any, propertyKey: string | symbol | undefined, descriptor?: PropertyDescriptor) {
        const key = propertyKey as string;
        addMiddleware(target, key, {
            type: 'validate',
            options: { schema }
        });
    };
}

/**
 * Rate limiting decorator
 */
export function RateLimit(options: { max: number; windowMs: number; message?: string }): MethodDecorator {
    return function (target: any, propertyKey: string | symbol | undefined, descriptor?: PropertyDescriptor) {
        const key = propertyKey as string;
        addMiddleware(target, key, {
            type: 'rateLimit',
            options
        });
    };
}

/**
 * CORS decorator
 */
export function CORS(options?: any): MethodDecorator {
    return function (target: any, propertyKey: string | symbol | undefined, descriptor?: PropertyDescriptor) {
        const key = propertyKey as string;
        addMiddleware(target, key, {
            type: 'cors',
            options
        });
    };
}

// =============================================================================
// METHOD DECORATORS - ROUTES
// =============================================================================

/**
 * HTTP method decorator factory
 */
function createMethodDecorator(method: string) {
    return function (path: string = ''): MethodDecorator {
        return function (target: any, propertyKey: string | symbol | undefined, descriptor?: PropertyDescriptor) {
            const key = propertyKey as string;
            addRoute(target, key, method, path);
        };
    };
}

/**
 * GET route decorator
 */
export const GET = createMethodDecorator('get');

/**
 * POST route decorator
 */
export const POST = createMethodDecorator('post');

/**
 * PUT route decorator
 */
export const PUT = createMethodDecorator('put');

/**
 * DELETE route decorator
 */
export const DELETE = createMethodDecorator('delete');

/**
 * PATCH route decorator
 */
export const PATCH = createMethodDecorator('patch');

// =============================================================================
// METADATA EXTRACTION UTILITIES
// =============================================================================

/**
 * Extract all routes from a handler class
 */
export function getRoutes(target: any): RouteMetadata[] {
    const rawRoutes = Reflect.getMetadata(ROUTES_KEY, target) || [];
    
    // Resolve middleware metadata for each route
    return rawRoutes.map((rawRoute: any) => {
        const middlewares = Reflect.getMetadata(MIDDLEWARES_KEY, rawRoute.target, rawRoute.propertyKey) || [];
        
        return {
            method: rawRoute.method,
            path: rawRoute.path,
            middlewares,
            handler: rawRoute.handler
        } as RouteMetadata;
    });
}

/**
 * Extract class metadata from a handler class
 */
export function getClassMetadata(target: any): ClassMetadata | undefined {
    return Reflect.getMetadata(CLASS_METADATA_KEY, target);
}

/**
 * Get full route path by combining class base path and method path
 */
export function getFullPath(classMetadata: ClassMetadata | undefined, routePath: string): string {
    const basePath = classMetadata?.basePath || '';
    const normalizedBasePath = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
    const normalizedRoutePath = routePath.startsWith('/') ? routePath : `/${routePath}`;
    
    if (!normalizedBasePath) {
        return normalizedRoutePath;
    }
    
    return normalizedBasePath + normalizedRoutePath;
}

/**
 * Extract all route information from a handler class (convenience function)
 */
export function extractRouteInfo(HandlerClass: any): {
    classMetadata: ClassMetadata | undefined;
    routes: RouteMetadata[];
} {
    const classMetadata = getClassMetadata(HandlerClass);
    const routes = getRoutes(HandlerClass);
    
    return { classMetadata, routes };
}

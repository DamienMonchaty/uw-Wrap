/**
 * General middleware decorators
 * Following Single Responsibility Principle - only general middleware decorators
 */

import { MetadataUtils } from './MetadataUtils';
import { RateLimitOptions, CorsOptions } from './types';

// =============================================================================
// RATE LIMITING DECORATORS
// =============================================================================

/**
 * Rate limiting decorator
 * Applies rate limiting to the decorated route
 * @param options - Rate limiting configuration
 * @example @RateLimit({ max: 100, windowMs: 60000 })
 */
export function RateLimit(options: RateLimitOptions): MethodDecorator {
    return function (target: any, propertyKey: string | symbol | undefined, descriptor?: PropertyDescriptor) {
        const key = propertyKey as string;
        
        MetadataUtils.addMiddleware(target, key, {
            type: 'rateLimit',
            options
        });
    };
}

/**
 * Strict rate limiting (lower limits)
 * @param max - Maximum requests (default: 10)
 * @param windowMs - Time window in milliseconds (default: 60000 = 1 minute)
 * @example @StrictRateLimit() or @StrictRateLimit(5, 30000)
 */
export function StrictRateLimit(max: number = 10, windowMs: number = 60000): MethodDecorator {
    return RateLimit({
        max,
        windowMs,
        message: 'Too many requests, please try again later.'
    });
}

/**
 * Relaxed rate limiting (higher limits)
 * @param max - Maximum requests (default: 1000)
 * @param windowMs - Time window in milliseconds (default: 60000 = 1 minute)
 * @example @RelaxedRateLimit() or @RelaxedRateLimit(2000, 60000)
 */
export function RelaxedRateLimit(max: number = 1000, windowMs: number = 60000): MethodDecorator {
    return RateLimit({
        max,
        windowMs,
        message: 'Rate limit exceeded, please slow down.'
    });
}

// =============================================================================
// CORS DECORATORS
// =============================================================================

/**
 * CORS decorator
 * Applies CORS configuration to the decorated route
 * @param options - CORS configuration (optional)
 * @example @CORS() or @CORS({ origin: 'https://example.com' })
 */
export function CORS(options?: CorsOptions): MethodDecorator {
    return function (target: any, propertyKey: string | symbol | undefined, descriptor?: PropertyDescriptor) {
        const key = propertyKey as string;
        
        MetadataUtils.addMiddleware(target, key, {
            type: 'cors',
            options
        });
    };
}

/**
 * Allow all origins CORS
 * @example @AllowAllOrigins()
 */
export function AllowAllOrigins(): MethodDecorator {
    return CORS({
        origin: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true
    });
}

/**
 * Restrict to specific origins
 * @param origins - Allowed origins
 * @example @AllowOrigins(['https://app.com', 'https://admin.com'])
 */
export function AllowOrigins(origins: string[]): MethodDecorator {
    return CORS({
        origin: origins,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true
    });
}

// =============================================================================
// CACHING DECORATORS
// =============================================================================

/**
 * Cache decorator
 * Applies caching to the decorated route
 * @param ttl - Time to live in seconds
 * @param key - Cache key pattern (optional)
 * @example @Cache(300) or @Cache(60, 'user-:id')
 */
export function Cache(ttl: number, key?: string): MethodDecorator {
    return function (target: any, propertyKey: string | symbol | undefined, descriptor?: PropertyDescriptor) {
        const methodKey = propertyKey as string;
        
        MetadataUtils.addMiddleware(target, methodKey, {
            type: 'cache' as any,
            options: {
                ttl,
                key: key || `${target.constructor.name}:${methodKey}`
            }
        });
    };
}

/**
 * No cache decorator
 * Explicitly disables caching for the route
 * @example @NoCache()
 */
export function NoCache(): MethodDecorator {
    return function (target: any, propertyKey: string | symbol | undefined, descriptor?: PropertyDescriptor) {
        const key = propertyKey as string;
        
        MetadataUtils.addMiddleware(target, key, {
            type: 'cache' as any,
            options: {
                disabled: true
            }
        });
    };
}

// =============================================================================
// CUSTOM MIDDLEWARE DECORATORS
// =============================================================================

/**
 * Apply custom middleware to a route
 * @param middlewareFunction - Custom middleware function
 * @example @UseMiddleware(myCustomMiddleware)
 */
export function UseMiddleware(middlewareFunction: Function): MethodDecorator {
    return function (target: any, propertyKey: string | symbol | undefined, descriptor?: PropertyDescriptor) {
        const key = propertyKey as string;
        
        MetadataUtils.addMiddleware(target, key, {
            type: 'custom' as any,
            options: {
                middleware: middlewareFunction
            }
        });
    };
}

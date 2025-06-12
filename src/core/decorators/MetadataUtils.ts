/**
 * Metadata utilities for decorator system
 * Following Single Responsibility Principle - only metadata manipulation
 */

import 'reflect-metadata';
import { 
    MiddlewareMetadata, 
    RawRouteMetadata, 
    METADATA_KEYS,
    RouteMetadata,
    ClassMetadata
} from './types';

export class MetadataUtils {
    /**
     * Add middleware metadata to a method
     */
    static addMiddleware(target: any, propertyKey: string, middleware: MiddlewareMetadata): void {
        const existingMiddlewares = Reflect.getMetadata(METADATA_KEYS.MIDDLEWARES, target, propertyKey) || [];
        existingMiddlewares.push(middleware);
        Reflect.defineMetadata(METADATA_KEYS.MIDDLEWARES, existingMiddlewares, target, propertyKey);
    }

    /**
     * Add route metadata to a method
     */
    static addRoute(target: any, propertyKey: string, method: string, path: string): void {
        const route: RawRouteMetadata = {
            method,
            path,
            handler: propertyKey,
            target: target,
            propertyKey: propertyKey
        };

        const existingRoutes = Reflect.getMetadata(METADATA_KEYS.ROUTES, target.constructor) || [];
        existingRoutes.push(route);
        Reflect.defineMetadata(METADATA_KEYS.ROUTES, existingRoutes, target.constructor);
    }

    /**
     * Extract all routes from a handler class
     */
    static getRoutes(target: any): RouteMetadata[] {
        const rawRoutes: RawRouteMetadata[] = Reflect.getMetadata(METADATA_KEYS.ROUTES, target) || [];
        
        // Resolve middleware metadata for each route
        return rawRoutes.map((rawRoute) => {
            const middlewares = Reflect.getMetadata(METADATA_KEYS.MIDDLEWARES, rawRoute.target, rawRoute.propertyKey) || [];
            
            return {
                method: rawRoute.method as any,
                path: rawRoute.path,
                middlewares,
                handler: rawRoute.handler
            } as RouteMetadata;
        });
    }

    /**
     * Extract class metadata from a handler class
     */
    static getClassMetadata(target: any): ClassMetadata | undefined {
        return Reflect.getMetadata(METADATA_KEYS.CLASS_METADATA, target);
    }

    /**
     * Set class metadata on a handler class
     */
    static setClassMetadata(target: any, metadata: ClassMetadata): void {
        Reflect.defineMetadata(METADATA_KEYS.CLASS_METADATA, metadata, target);
    }

    /**
     * Get full route path by combining class base path and method path
     */
    static getFullPath(classMetadata: ClassMetadata | undefined, routePath: string): string {
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
    static extractRouteInfo(HandlerClass: any): {
        classMetadata: ClassMetadata | undefined;
        routes: RouteMetadata[];
    } {
        const classMetadata = this.getClassMetadata(HandlerClass);
        const routes = this.getRoutes(HandlerClass);
        
        return { classMetadata, routes };
    }
}

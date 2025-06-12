/**
 * Route Registry - manages route metadata and registration
 * Following Single Responsibility Principle - only route metadata management
 */

import { RouteMetadata, ClassMetadata } from '../decorators/types';
import { MetadataUtils } from '../decorators/MetadataUtils';

export interface RegisteredRoute extends RouteMetadata {
    fullPath: string;
    handlerClass: any;
    handlerInstance: any;
}

export class RouteRegistry {
    private routes: Map<string, RegisteredRoute> = new Map();
    private routesByHandler: Map<any, RegisteredRoute[]> = new Map();

    /**
     * Register routes from a handler class
     */
    registerHandler(HandlerClass: any, handlerInstance: any): RegisteredRoute[] {
        const { classMetadata, routes } = MetadataUtils.extractRouteInfo(HandlerClass);
        const registeredRoutes: RegisteredRoute[] = [];

        for (const route of routes) {
            const fullPath = MetadataUtils.getFullPath(classMetadata, route.path);
            const routeKey = `${route.method.toUpperCase()} ${fullPath}`;

            const registeredRoute: RegisteredRoute = {
                ...route,
                fullPath,
                handlerClass: HandlerClass,
                handlerInstance
            };

            // Check for duplicate routes
            if (this.routes.has(routeKey)) {
                throw new Error(
                    `Duplicate route registration: ${routeKey} is already registered by ${this.routes.get(routeKey)?.handlerClass.name}`
                );
            }

            this.routes.set(routeKey, registeredRoute);
            registeredRoutes.push(registeredRoute);
        }

        // Store routes by handler for easier lookup
        this.routesByHandler.set(HandlerClass, registeredRoutes);

        return registeredRoutes;
    }

    /**
     * Get all registered routes
     */
    getAllRoutes(): RegisteredRoute[] {
        return Array.from(this.routes.values());
    }

    /**
     * Get routes by handler class
     */
    getRoutesByHandler(HandlerClass: any): RegisteredRoute[] {
        return this.routesByHandler.get(HandlerClass) || [];
    }

    /**
     * Get route by method and path
     */
    getRoute(method: string, path: string): RegisteredRoute | undefined {
        const routeKey = `${method.toUpperCase()} ${path}`;
        return this.routes.get(routeKey);
    }

    /**
     * Check if a route exists
     */
    hasRoute(method: string, path: string): boolean {
        const routeKey = `${method.toUpperCase()} ${path}`;
        return this.routes.has(routeKey);
    }

    /**
     * Remove routes for a handler class
     */
    unregisterHandler(HandlerClass: any): void {
        const routes = this.routesByHandler.get(HandlerClass);
        if (routes) {
            for (const route of routes) {
                const routeKey = `${route.method.toUpperCase()} ${route.fullPath}`;
                this.routes.delete(routeKey);
            }
            this.routesByHandler.delete(HandlerClass);
        }
    }

    /**
     * Clear all registered routes
     */
    clear(): void {
        this.routes.clear();
        this.routesByHandler.clear();
    }

    /**
     * Get route statistics
     */
    getStats(): {
        totalRoutes: number;
        routesByMethod: Record<string, number>;
        handlerCount: number;
    } {
        const routes = this.getAllRoutes();
        const routesByMethod: Record<string, number> = {};

        for (const route of routes) {
            const method = route.method.toUpperCase();
            routesByMethod[method] = (routesByMethod[method] || 0) + 1;
        }

        return {
            totalRoutes: routes.length,
            routesByMethod,
            handlerCount: this.routesByHandler.size
        };
    }

    /**
     * Generate route documentation
     */
    generateDocs(): Array<{
        method: string;
        path: string;
        handler: string;
        middlewares: string[];
        class: string;
    }> {
        return this.getAllRoutes().map(route => ({
            method: route.method.toUpperCase(),
            path: route.fullPath,
            handler: route.handler,
            middlewares: route.middlewares.map(m => m.type),
            class: route.handlerClass.name
        }));
    }
}

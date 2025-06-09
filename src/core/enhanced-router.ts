/**
 * Enhanced Router for uW-Wrap with decorator support
 * Automatically registers routes from decorated handler classes
 */

import { UWebSocketWrapper } from './server-wrapper';
import { RouteMetadata, MiddlewareMetadata, extractRouteInfo, getFullPath } from './route-decorators';
import { 
    Middleware, 
    MiddlewareContext, 
    CorsMiddleware, 
    LoggingMiddleware, 
    AuthenticationMiddleware, 
    ValidationMiddleware, 
    RateLimitingMiddleware 
} from './authentication-middleware';
import { Logger } from '../utils/logger';
import { ErrorHandler } from '../utils/errorHandler';

export interface RouterOptions {
    globalMiddlewares?: Middleware[];
    corsOptions?: any;
    enableLogging?: boolean;
    jwtManager?: any;
}

export class EnhancedRouter {
    private wrapper: UWebSocketWrapper;
    private logger: Logger;
    private errorHandler: ErrorHandler;
    private globalMiddlewares: Middleware[] = [];
    private jwtManager?: any;

    constructor(
        wrapper: UWebSocketWrapper,
        logger: Logger,
        errorHandler: ErrorHandler,
        options: RouterOptions = {}
    ) {
        this.wrapper = wrapper;
        this.logger = logger;
        this.errorHandler = errorHandler;
        this.jwtManager = options.jwtManager;

        // Setup global middlewares
        if (options.corsOptions !== false) {
            this.globalMiddlewares.push(new CorsMiddleware(options.corsOptions));
        }

        if (options.enableLogging !== false) {
            this.globalMiddlewares.push(new LoggingMiddleware(logger));
        }

        if (options.globalMiddlewares) {
            this.globalMiddlewares.push(...options.globalMiddlewares);
        }
    }

    /**
     * Register a handler class with decorators
     */
    registerHandler(HandlerClass: any, handlerInstance?: any): void {
        const { classMetadata, routes } = extractRouteInfo(HandlerClass);

        if (routes.length === 0) {
            this.logger.warn(`No routes found for handler: ${HandlerClass.name}`);
            return;
        }

        for (const route of routes) {
            const fullPath = getFullPath(classMetadata, route.path);
            // Debug: Log middleware metadata for each route
            this.logger.debug(`Route ${route.method.toUpperCase()} ${fullPath} middlewares:`, route.middlewares);
            this.registerRoute(route, fullPath, handlerInstance || new HandlerClass());
        }

        this.logger.info(`Registered ${routes.length} routes from ${HandlerClass.name} with base path: ${classMetadata?.basePath || '/'}`);
    }

    /**
     * Register multiple handlers
     */
    registerHandlers(handlers: Array<{ HandlerClass: any; instance?: any }>): void {
        for (const { HandlerClass, instance } of handlers) {
            this.registerHandler(HandlerClass, instance);
        }
    }

    /**
     * Register a single route with its middlewares
     */
    private registerRoute(route: RouteMetadata, fullPath: string, handlerInstance: any): void {
        const middlewares = this.buildMiddlewareChain(route.middlewares);
        const handler = handlerInstance[route.handler].bind(handlerInstance);

        // Create the complete handler with middleware chain
        const completeHandler = async (req: any, res: any) => {
            // Check if response is already aborted before any operations
            if (res.aborted) {
                return;
            }

            // Extract all request data BEFORE any async operations
            const params = this.extractParams(req, fullPath);
            const query = this.extractQuery(req);
            const headers = this.extractHeaders(req);
            const method = req.getMethod ? req.getMethod().toLowerCase() : 'unknown';
            const url = req.getUrl ? req.getUrl() : 'unknown';

            // Read body for POST/PUT/PATCH requests
            let body = null;
            if (['post', 'put', 'patch'].includes(route.method.toLowerCase())) {
                try {
                    const bodyText = await this.wrapper.readBody(res);
                    if (bodyText) {
                        body = JSON.parse(bodyText);
                    }
                } catch (error) {
                    this.logger.error(`Failed to parse request body: ${(error as Error).message}`);
                    if (!res.aborted) {
                        this.wrapper.sendJSON(res, { error: 'Invalid JSON in request body' }, 400);
                    }
                    return;
                }
            }

            // Check again after async body reading
            if (res.aborted) {
                return;
            }

            // Attach parsed body to request for easy access in handlers
            if (body) {
                (req as any).body = body;
            }

            // Attach params to request for easy access in handlers
            (req as any).params = params;

            const context: MiddlewareContext = {
                req,
                res,
                data: {},
                body,
                params,
                query,
                headers,
                method,
                url
            };

            try {
                await this.executeMiddlewareChain([...this.globalMiddlewares, ...middlewares], context, async () => {
                    // Execute the actual handler
                    const result = await handler(context.req, context.res);
                    
                    // If handler returns data, send it as JSON (check aborted before sending)
                    if (result && !res.aborted) {
                        this.wrapper.sendJSON(res, result);
                    }
                });
            } catch (error) {
                // Handle error immediately without accessing req/res later
                const requestId = this.generateRequestId();
                const errorContext = `${route.method.toUpperCase()} ${route.path}`;
                
                this.logger.error(`Route error in ${errorContext}: ${(error as Error).message}`, {
                    requestId,
                    params,
                    query,
                    error: (error as Error).stack
                });

                // Send error response if not aborted
                if (!res.aborted) {
                    const { response: errorResponse, statusCode } = this.errorHandler.handleError(error as Error, errorContext, requestId);
                    this.wrapper.sendJSON(res, errorResponse, statusCode);
                }
            }
        };

        // Register with wrapper
        this.wrapper.addHttpHandler(route.method as any, fullPath, completeHandler);
        this.logger.debug(`Registered ${route.method.toUpperCase()} ${fullPath}`);
    }

    /**
     * Build middleware chain from metadata
     */
    private buildMiddlewareChain(middlewareMetadata: MiddlewareMetadata[]): Middleware[] {
        const middlewares: Middleware[] = [];

        for (const meta of middlewareMetadata) {
            let middleware: Middleware;

            switch (meta.type) {
                case 'auth':
                    if (!this.jwtManager) {
                        throw new Error('JWT Manager not configured for authentication middleware');
                    }
                    middleware = new AuthenticationMiddleware(this.jwtManager, meta.options, this.logger);
                    break;

                case 'validate':
                    middleware = new ValidationMiddleware(meta.options.schema);
                    break;

                case 'rateLimit':
                    middleware = new RateLimitingMiddleware(meta.options);
                    break;

                case 'cors':
                    middleware = new CorsMiddleware(meta.options);
                    break;

                default:
                    this.logger.warn(`Unknown middleware type: ${meta.type}`);
                    continue;
            }

            middlewares.push(middleware);
        }

        return middlewares;
    }

    /**
     * Execute middleware chain
     */
    private async executeMiddlewareChain(
        middlewares: Middleware[], 
        context: MiddlewareContext, 
        finalHandler: () => Promise<void>
    ): Promise<void> {
        let index = 0;

        const next = async (): Promise<void> => {
            if (index >= middlewares.length) {
                await finalHandler();
                return;
            }

            const middleware = middlewares[index++];
            await middleware.execute(context, next);
        };

        await next();
    }

    /**
     * Extract path parameters
     */
    private extractParams(req: any, routePath?: string): Record<string, string> {
        try {
            const params: Record<string, string> = {};
            
            if (!routePath) {
                // Fallback to empty params if no route path
                return {};
            }
            
            // Extract parameter names from route path (e.g., /users/:id -> ['id'])
            const paramNames = this.extractParamNames(routePath);
            
            if (paramNames.length === 0) {
                return {};
            }
            
            // Get parameter values using uWS parameter access
            for (let i = 0; i < paramNames.length; i++) {
                const paramName = paramNames[i];
                const paramValue = req.getParameter ? req.getParameter(i) : undefined;
                if (paramValue !== undefined) {
                    params[paramName] = paramValue;
                }
            }
            
            return params;
        } catch (error) {
            return {};
        }
    }

    /**
     * Extract parameter names from route path
     */
    private extractParamNames(routePath: string): string[] {
        const paramRegex = /:([^/]+)/g;
        const paramNames: string[] = [];
        let match;
        
        while ((match = paramRegex.exec(routePath)) !== null) {
            paramNames.push(match[1]);
        }
        
        return paramNames;
    }

    /**
     * Extract query parameters
     */
    private extractQuery(req: any): Record<string, string> {
        try {
            const query = req.getQuery();
            const params: Record<string, string> = {};
            
            if (query) {
                const searchParams = new URLSearchParams(query);
                for (const [key, value] of searchParams.entries()) {
                    params[key] = value;
                }
            }
            
            return params;
        } catch {
            return {};
        }
    }

    /**
     * Extract headers
     */
    private extractHeaders(req: any): Record<string, string> {
        const headers: Record<string, string> = {};
        
        try {
            // Common headers
            const commonHeaders = ['authorization', 'content-type', 'user-agent', 'x-forwarded-for'];
            
            for (const header of commonHeaders) {
                const value = req.getHeader(header);
                if (value) {
                    headers[header] = value;
                }
            }
            
            // Debug logging for header extraction
            console.log(`[HEADER DEBUG] URL: ${req.getUrl()}, Headers extracted:`, Object.keys(headers));
            if (headers['authorization']) {
                console.log(`[HEADER DEBUG] Authorization header found: ${headers['authorization'].substring(0, 20)}...`);
            } else {
                console.log(`[HEADER DEBUG] Authorization header MISSING!`);
            }
        } catch (error) {
            console.log(`[HEADER DEBUG] Header extraction error:`, error);
        }
        
        return headers;
    }

    /**
     * Generate request ID
     */
    private generateRequestId(): string {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Add global middleware
     */
    addGlobalMiddleware(middleware: Middleware): void {
        this.globalMiddlewares.push(middleware);
    }

    /**
     * Get registered routes info
     */
    getRoutesInfo(): Array<{ method: string; path: string; middlewares: string[] }> {
        // This would require tracking registered routes
        // Implementation depends on how detailed you want the info
        return [];
    }
}

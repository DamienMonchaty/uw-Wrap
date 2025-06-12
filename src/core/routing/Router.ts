/**
 * Enhanced Router - Main routing class refactored following SOLID principles
 * Following Single Responsibility Principle - only core routing functionality
 */

import { UWebSocketWrapper } from '../ServerWrapper';
import { Logger } from '../../utils/logger';
import { ErrorHandler } from '../../utils/errorHandler';
import { HttpHandlerUtils } from '../../utils/handlers';

import { RouteRegistry, RegisteredRoute } from './RouteRegistry';
import { MiddlewareManager, MiddlewareServices } from './MiddlewareManager';
import { GuardManager, GuardContext } from './Guards';

import { MiddlewareContext } from '../../middleware/AuthenticationMiddleware';

export interface RouterOptions {
    corsOptions?: any;
    enableLogging?: boolean;
    jwtManager?: any;
    userRoleService?: any;
    authErrorHandler?: any;
}

export class Router {
    private wrapper: UWebSocketWrapper;
    private logger: Logger;
    private errorHandler: ErrorHandler;
    
    // Specialized managers following SRP
    private routeRegistry: RouteRegistry;
    private middlewareManager: MiddlewareManager;
    private guardManager: GuardManager;

    constructor(
        wrapper: UWebSocketWrapper,
        logger: Logger,
        errorHandler: ErrorHandler,
        options: RouterOptions = {}
    ) {
        this.wrapper = wrapper;
        this.logger = logger;
        this.errorHandler = errorHandler;

        // Initialize specialized managers
        this.routeRegistry = new RouteRegistry();
        
        const middlewareServices: MiddlewareServices = {
            logger: this.logger,
            jwtManager: options.jwtManager,
            userRoleService: options.userRoleService,
            authErrorHandler: options.authErrorHandler
        };
        this.middlewareManager = new MiddlewareManager(middlewareServices);
        this.guardManager = new GuardManager(this.logger);

        // Setup default configurations
        this.setupDefaultConfiguration(options);
    }

    /**
     * Setup default router configuration
     */
    private setupDefaultConfiguration(options: RouterOptions): void {
        // Setup CORS if enabled
        if (options.corsOptions !== false) {
            const corsMiddleware = this.middlewareManager.createMiddlewares([{
                type: 'cors',
                options: options.corsOptions
            }])[0];
            
            if (corsMiddleware) {
                this.middlewareManager.addGlobalMiddleware(corsMiddleware);
            }
        }

        // Setup logging if enabled
        if (options.enableLogging !== false) {
            const loggingMiddleware = this.middlewareManager.createMiddlewares([{
                type: 'logging',
                options: {}
            }])[0];
            
            if (loggingMiddleware) {
                this.middlewareManager.addGlobalMiddleware(loggingMiddleware);
            }
        }
    }

    /**
     * Register a handler class with its routes
     */
    registerHandler(HandlerClass: any, handlerInstance?: any): void {
        try {
            const instance = handlerInstance || new HandlerClass();
            const registeredRoutes = this.routeRegistry.registerHandler(HandlerClass, instance);

            // Register each route with the underlying server
            for (const route of registeredRoutes) {
                this.registerRouteWithServer(route);
            }

            this.logger.info(`Registered ${registeredRoutes.length} routes for ${HandlerClass.name}`);
        } catch (error) {
            this.logger.error(`Failed to register handler ${HandlerClass.name}:`, error);
            throw error;
        }
    }

    /**
     * Register a single route with the underlying server
     */
    private registerRouteWithServer(route: RegisteredRoute): void {
        const { method, fullPath, handlerInstance, handler: handlerMethodName, middlewares } = route;

        // Create middleware instances for this route
        const routeMiddlewares = this.middlewareManager.createMiddlewares(middlewares);

        // Create the route handler
        const routeHandler = async (response: any, request: any) => {
            const context: MiddlewareContext & GuardContext = {
                req: request,
                res: response,
                data: {},
                user: undefined,
                permissions: undefined,
                metadata: {}
            };

            try {
                // Extract request data using utilities
                const requestId = HttpHandlerUtils.generateRequestId();
                const clientIP = HttpHandlerUtils.getClientIP(request);
                
                // Initialize data object if needed
                if (!context.data) {
                    context.data = {};
                }
                
                // Add request metadata
                context.data.requestId = requestId;
                context.data.clientIP = clientIP;
                context.data.startTime = Date.now();

                // Execute middleware chain
                const middlewareSuccess = await this.middlewareManager.executeMiddlewareChain(
                    routeMiddlewares,
                    context
                );

                if (!middlewareSuccess) {
                    return; // Response already sent by middleware
                }

                // Execute guards
                const guardSuccess = await this.guardManager.executeGuards(context);
                if (!guardSuccess) {
                    return; // Response already sent by guard
                }

                // Execute the actual handler method
                const handlerMethod = handlerInstance[handlerMethodName];
                if (typeof handlerMethod === 'function') {
                    await handlerMethod.call(handlerInstance, context);
                } else {
                    throw new Error(`Handler method '${handlerMethodName}' not found`);
                }

            } catch (error) {
                await this.handleRouteError(error, context, route);
            }
        };

        // Register with the underlying server using the addHttpHandler method
        const httpMethod = method.toLowerCase() as 'get' | 'post' | 'put' | 'delete';
        
        // Convert to the expected handler signature (req, res) instead of (res, req)
        const httpHandler = (req: any, res: any) => {
            routeHandler(res, req); // Router expects (response, request)
        };

        if (['get', 'post', 'put', 'delete'].includes(httpMethod)) {
            this.wrapper.addHttpHandler(httpMethod, fullPath, httpHandler);
        } else if (method.toLowerCase() === 'patch') {
            // PATCH might not be supported by the wrapper, log a warning
            this.logger.warn(`PATCH method not supported by wrapper for route: ${fullPath}`);
        } else {
            throw new Error(`Unsupported HTTP method: ${method}`);
        }

        this.logger.debug(`Registered route: ${method.toUpperCase()} ${fullPath}`);
    }

    /**
     * Handle route execution errors
     */
    private async handleRouteError(
        error: any, 
        context: MiddlewareContext, 
        route: RegisteredRoute
    ): Promise<void> {
        this.logger.error(`Error in route ${route.method.toUpperCase()} ${route.fullPath}:`, error);

        // Use a flag to track if response was already sent
        // In uWS, we can't easily check if response was sent, so we'll wrap it
        let responseSent = false;
        
        if (!responseSent) {
            try {
                const requestId = String(context.data?.requestId || 'unknown');
                const routeContext = `${route.method.toUpperCase()} ${route.fullPath}`;
                const { response: errorResponse, statusCode } = this.errorHandler.handleError(error, routeContext, requestId);
                
                context.res
                    .writeStatus(`${statusCode} ${this.getStatusText(statusCode)}`)
                    .writeHeader('Content-Type', 'application/json')
                    .end(JSON.stringify(errorResponse));
                    
                responseSent = true;
            } catch (handlerError) {
                this.logger.error('Error handler failed:', String(handlerError));
                
                // Fallback error response
                if (!responseSent) {
                    context.res
                        .writeStatus('500 Internal Server Error')
                        .writeHeader('Content-Type', 'application/json')
                        .end(JSON.stringify({
                            error: 'Internal Server Error',
                            message: 'An unexpected error occurred'
                        }));
                }
            }
        }
    }

    /**
     * Get HTTP status text from status code
     */
    private getStatusText(statusCode: number): string {
        const statusTexts: Record<number, string> = {
            200: 'OK',
            400: 'Bad Request',
            401: 'Unauthorized',
            403: 'Forbidden',
            404: 'Not Found',
            409: 'Conflict',
            422: 'Unprocessable Entity',
            429: 'Too Many Requests',
            500: 'Internal Server Error',
            502: 'Bad Gateway',
            503: 'Service Unavailable',
            504: 'Gateway Timeout'
        };
        return statusTexts[statusCode] || 'Unknown Status';
    }

    /**
     * Get router statistics
     */
    getStats(): {
        routes: any;
        middlewares: any;
        guards: any;
    } {
        return {
            routes: this.routeRegistry.getStats(),
            middlewares: this.middlewareManager.getStats(),
            guards: this.guardManager.getStats()
        };
    }

    /**
     * Generate API documentation
     */
    generateApiDocs(): any {
        return {
            routes: this.routeRegistry.generateDocs(),
            middlewares: this.middlewareManager.getRegisteredTypes(),
            guards: this.guardManager.getStats().registeredGuards
        };
    }

    /**
     * Get route registry (for advanced usage)
     */
    getRouteRegistry(): RouteRegistry {
        return this.routeRegistry;
    }

    /**
     * Get middleware manager (for advanced usage)
     */
    getMiddlewareManager(): MiddlewareManager {
        return this.middlewareManager;
    }

    /**
     * Get guard manager (for advanced usage)
     */
    getGuardManager(): GuardManager {
        return this.guardManager;
    }
}

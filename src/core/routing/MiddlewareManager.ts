/**
 * Middleware Manager - handles middleware chain execution
 * Following Single Responsibility Principle - only middleware management
 */

import { MiddlewareMetadata } from '../decorators/types';
import { 
    Middleware, 
    MiddlewareContext, 
    NextFunction,
    AuthenticationMiddleware 
} from '../../middleware/AuthenticationMiddleware';
import { CorsMiddleware } from '../../middleware/CorsMiddleware';
import { ValidationMiddleware } from '../../middleware/ValidationMiddleware';
import { RateLimitingMiddleware } from '../../middleware/RateLimitingMiddleware';
import { LoggingMiddleware } from '../../middleware/LoggingMiddleware';
import { Logger } from '../../utils/logger';

export interface MiddlewareServices {
    logger: Logger;
    jwtManager?: any;
    userRoleService?: any;
    authErrorHandler?: any;
}

export class MiddlewareManager {
    private globalMiddlewares: Middleware[] = [];
    private middlewareFactories: Map<string, (options: any) => Middleware> = new Map();
    private services: MiddlewareServices;

    constructor(services: MiddlewareServices) {
        this.services = services;
        this.setupDefaultFactories();
    }

    /**
     * Setup default middleware factories
     */
    private setupDefaultFactories(): void {
        this.middlewareFactories.set('auth', (options) => 
            new AuthenticationMiddleware(
                this.services.jwtManager,
                this.services.userRoleService,
                this.services.authErrorHandler,
                options
            )
        );

        this.middlewareFactories.set('cors', (options) => 
            new CorsMiddleware(options)
        );

        this.middlewareFactories.set('validate', (options) => 
            new ValidationMiddleware(options.schema, options)
        );

        this.middlewareFactories.set('rateLimit', (options) => 
            new RateLimitingMiddleware(options)
        );

        this.middlewareFactories.set('logging', (options) => 
            new LoggingMiddleware(this.services.logger, options)
        );
    }

    /**
     * Add a global middleware
     */
    addGlobalMiddleware(middleware: Middleware): void {
        this.globalMiddlewares.push(middleware);
    }

    /**
     * Register a custom middleware factory
     */
    registerMiddlewareFactory(type: string, factory: (options: any) => Middleware): void {
        this.middlewareFactories.set(type, factory);
    }

    /**
     * Create middleware instances from metadata
     */
    createMiddlewares(middlewareMetadata: MiddlewareMetadata[]): Middleware[] {
        const middlewares: Middleware[] = [];

        for (const metadata of middlewareMetadata) {
            const factory = this.middlewareFactories.get(metadata.type);
            if (factory) {
                try {
                    const middleware = factory(metadata.options || {});
                    middlewares.push(middleware);
                } catch (error) {
                    this.services.logger.error(`Failed to create middleware of type '${metadata.type}':`, error);
                    throw new Error(`Failed to create middleware of type '${metadata.type}': ${error}`);
                }
            } else if (metadata.type === 'custom' && metadata.options?.middleware) {
                // Handle custom middleware functions
                const customMiddleware = this.wrapCustomMiddleware(metadata.options.middleware);
                middlewares.push(customMiddleware);
            } else {
                this.services.logger.warn(`Unknown middleware type: ${metadata.type}`);
            }
        }

        return middlewares;
    }

    /**
     * Wrap a custom middleware function to match our interface
     */
    private wrapCustomMiddleware(middlewareFunction: Function): Middleware {
        return {
            async execute(context: MiddlewareContext, next: NextFunction): Promise<void> {
                await middlewareFunction(context);
                await next();
            }
        };
    }

    /**
     * Execute middleware chain
     */
    async executeMiddlewareChain(
        middlewares: Middleware[],
        context: MiddlewareContext
    ): Promise<boolean> {
        const allMiddlewares = [...this.globalMiddlewares, ...middlewares];
        let responseAborted = false;

        // Track if response is aborted
        context.res.onAborted(() => {
            responseAborted = true;
        });

        for (const middleware of allMiddlewares) {
            try {
                const nextCalled = { value: false };
                const next: NextFunction = async () => {
                    nextCalled.value = true;
                };

                await middleware.execute(context, next);
                
                // If next was not called, stop the chain
                if (!nextCalled.value) {
                    return false;
                }
                
                // If response is already sent, stop execution
                if (responseAborted) {
                    return false;
                }
            } catch (error) {
                this.services.logger.error('Middleware execution failed:', error);
                
                // Send error response if not already sent
                if (!responseAborted) {
                    try {
                        context.res
                            .writeStatus('500 Internal Server Error')
                            .writeHeader('Content-Type', 'application/json')
                            .end(JSON.stringify({
                                error: 'Internal Server Error',
                                message: 'Middleware execution failed'
                            }));
                    } catch (responseError) {
                        // Response might already be closed
                        this.services.logger.warn('Failed to send error response:', responseError);
                    }
                }
                return false;
            }
        }

        return true;
    }

    /**
     * Get global middlewares
     */
    getGlobalMiddlewares(): Middleware[] {
        return [...this.globalMiddlewares];
    }

    /**
     * Clear global middlewares
     */
    clearGlobalMiddlewares(): void {
        this.globalMiddlewares = [];
    }

    /**
     * Get registered middleware types
     */
    getRegisteredTypes(): string[] {
        return Array.from(this.middlewareFactories.keys());
    }

    /**
     * Get middleware statistics
     */
    getStats(): {
        globalMiddlewareCount: number;
        registeredFactories: string[];
        factoryCount: number;
    } {
        return {
            globalMiddlewareCount: this.globalMiddlewares.length,
            registeredFactories: this.getRegisteredTypes(),
            factoryCount: this.middlewareFactories.size
        };
    }
}

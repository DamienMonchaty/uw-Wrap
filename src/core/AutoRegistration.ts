/**
 * Modern Auto-Registration System
 * Single responsibility: Component registration orchestration
 * Uses the new container system exclusively
 */

import 'reflect-metadata';
import { Container } from './container/Container';
import { SERVICE_TYPES } from './container/ServiceTypes';
import { ComponentRegistry, ComponentMetadata, RegistrationOptions } from './discovery/ComponentRegistry';
import { Logger } from '../utils/logger';

// Metadata key for injectable components
const INJECTABLE_KEY = Symbol('injectable');

export interface InjectableMetadata {
    identifier: string | symbol;
    singleton: boolean;
    type: 'service' | 'controller' | 'repository' | 'middleware' | 'component';
}

/**
 * Modern auto-registration system
 */
export class AutoRegistration {
    private static registeredClasses = new Set<any>();
    private static registry = new ComponentRegistry();

    /**
     * Register a class for auto-discovery
     */
    static registerClass(constructor: any): void {
        this.registeredClasses.add(constructor);
    }

    /**
     * Auto-register all discovered classes
     */
    static async autoRegister(
        container: Container,
        options: RegistrationOptions = { continueOnError: false, skipDuplicates: false },
        logger?: Logger
    ): Promise<{
        services: number;
        controllers: number;
        repositories: number;
        middlewares: number;
        components: number;
        total: number;
        errors: string[];
    }> {
        const stats = {
            services: 0,
            controllers: 0,
            repositories: 0,
            middlewares: 0,
            components: 0,
            total: 0,
            errors: [] as string[]
        };

        logger?.info(`🔄 Starting auto-registration of ${this.registeredClasses.size} components...`);

        const registry = new ComponentRegistry(logger);

        for (const constructor of this.registeredClasses) {
            try {
                const type = await this.registerSingleClass(container, constructor, registry);
                if (type) {
                    stats[type + 's' as keyof typeof stats]++;
                    stats.total++;
                }
            } catch (error) {
                const errorMessage = `Failed to register ${constructor.name}: ${error instanceof Error ? error.message : String(error)}`;
                stats.errors.push(errorMessage);
                logger?.warn(errorMessage);

                if (!options.continueOnError) {
                    throw new Error(errorMessage);
                }
            }
        }

        logger?.info(`✅ Auto-registration complete: ${stats.total} components registered`);
        return stats;
    }

    /**
     * Register a single class
     */
    private static async registerSingleClass(
        container: Container,
        constructor: any,
        registry: ComponentRegistry
    ): Promise<string | null> {
        const metadata = this.extractMetadata(constructor);
        if (!metadata) return null;

        const { identifier, singleton, type } = metadata;
        
        try {
            const factory = () => {
                // Get constructor parameters
                const paramTypes = Reflect.getMetadata('design:paramtypes', constructor) || [];
                
                console.log(`\n🔧 Creating ${constructor.name} with ${paramTypes.length} dependencies:`);
                paramTypes.forEach((paramType: any, index: number) => {
                    console.log(`  [${index}] ${paramType?.name || 'unknown'}`);
                });
                
                // Resolve dependencies
                const args = paramTypes.map((paramType: any, index: number) => {
                    console.log(`🔍 Resolving dependency [${index}]: ${paramType?.name || 'unknown'}`);
                    try {
                        const resolved = this.resolveDependency(container, paramType, constructor.name);
                        console.log(`✅ Resolved [${index}]: ${paramType?.name} -> ${resolved?.constructor?.name || 'instance'}`);
                        return resolved;
                    } catch (error) {
                        console.log(`❌ Failed to resolve [${index}]: ${paramType?.name} - ${error}`);
                        throw error;
                    }
                });

                console.log(`✅ All dependencies resolved for ${constructor.name}, creating instance...`);
                return new constructor(...args);
            };

            // Register based on singleton preference
            if (singleton) {
                container.registerSingleton(identifier, factory);
            } else {
                container.registerTransient(identifier, factory);
            }

            return type;
        } catch (error) {
            throw new Error(`Registration failed for ${String(identifier)}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Extract metadata from constructor
     */
    private static extractMetadata(constructor: any): InjectableMetadata | null {
        return Reflect.getMetadata(INJECTABLE_KEY, constructor) || null;
    }

    /**
     * Enhanced dependency resolution
     */
    private static resolveDependency(container: Container, paramType: any, consumerName: string): any {
        const typeName = paramType.name || paramType;
        
        try {
            // Try direct resolution first
            return container.resolve(typeName);
        } catch (error) {
            // Try common service mappings (string to string mappings)
            const commonMappings = this.getCommonServiceMappings();
            const mappedName = commonMappings[typeName];
            
            if (mappedName) {
                try {
                    return container.resolve(mappedName);
                } catch (commonError) {
                    console.log(`Failed to resolve ${typeName} -> ${mappedName} for ${consumerName}`);
                }
            }
            
            // Try with SERVICE_TYPES symbols
            try {
                const serviceTypeMapping = this.getServiceTypeMapping(typeName);
                if (serviceTypeMapping) {
                    return container.resolve(serviceTypeMapping);
                }
            } catch (serviceTypeError) {
                console.log(`Failed to resolve via SERVICE_TYPES mapping for ${typeName} in ${consumerName}`);
            }
            
            // List available services for debugging (safely handle symbols)
            try {
                const availableServices = container.getRegisteredServices();
                const serviceNames = availableServices.map(service => {
                    if (typeof service === 'symbol') {
                        return service.toString();
                    }
                    return String(service);
                }).filter(name => name !== 'null');
                console.log(`Available services: ${serviceNames.join(', ')}`);
                
                throw new Error(`Cannot resolve dependency: ${typeName} for ${consumerName}. Available: ${serviceNames.join(', ')}`);
            } catch (listError) {
                throw new Error(`Cannot resolve dependency: ${typeName} for ${consumerName}. Error listing services: ${listError}`);
            }
        }
    }

    /**
     * Get SERVICE_TYPES symbol mapping for a given type name
     */
    private static getServiceTypeMapping(typeName: string): symbol | null {
        const mappings: Record<string, symbol> = {
            'UWebSocketWrapper': SERVICE_TYPES.ServerWrapper,
            'Logger': SERVICE_TYPES.Logger,
            'ErrorHandler': SERVICE_TYPES.ErrorHandler,
            'Router': SERVICE_TYPES.Router,
            'Config': SERVICE_TYPES.Config
        };
        return mappings[typeName] || null;
    }

    /**
     * Common service name mappings (string to string)
     */
    private static getCommonServiceMappings(): Record<string, string> {
        return {
            'UserService': 'UserService',
            'UserServiceImpl': 'UserService', // Map implementation class to service identifier
            'ProductService': 'ProductService',
            'ProductRepository': 'ProductRepository',
            'UserRepository': 'UserRepository',
            'AppRepositoryManager': 'AppRepositoryManager',
            'RepositoryManager': 'AppRepositoryManager',
            'DatabaseProvider': 'DatabaseProvider'
        };
    }

    /**
     * Get statistics about registered classes
     */
    static getStats(): { 
        total: number; 
        byType: Record<string, number>;
        byLifetime: Record<string, number>;
    } {
        const byType: Record<string, number> = {};
        const byLifetime: Record<string, number> = {};
        let total = 0;

        for (const constructor of this.registeredClasses) {
            const metadata = this.extractMetadata(constructor);
            if (metadata) {
                byType[metadata.type] = (byType[metadata.type] || 0) + 1;
                byLifetime[metadata.singleton ? 'singleton' : 'transient'] = 
                    (byLifetime[metadata.singleton ? 'singleton' : 'transient'] || 0) + 1;
                total++;
            }
        }

        return { total, byType, byLifetime };
    }

    /**
     * Clear registered classes (useful for testing)
     */
    static clearRegistrations(): void {
        this.registeredClasses.clear();
    }

    /**
     * Get modern registry instance
     */
    static getModernRegistry(): ComponentRegistry {
        return this.registry;
    }

    /**
     * Process route decorators from registered controllers
     */
    static async processRouteDecorators(container: Container, logger?: Logger): Promise<void> {
        logger?.info('🔗 Processing route decorators from controllers...');
        
        try {
            // Get the server wrapper to register routes
            logger?.debug('Resolving ServerWrapper from container...');
            const serverWrapper = container.resolve(SERVICE_TYPES.ServerWrapper) as any;
            
            if (!serverWrapper) {
                throw new Error('ServerWrapper not found in container');
            }
            
            if (typeof serverWrapper.addHttpHandler !== 'function') {
                logger?.error('ServerWrapper methods available:', Object.getOwnPropertyNames(serverWrapper));
                throw new Error('ServerWrapper does not support route registration - missing addHttpHandler() method');
            }
            
            logger?.debug(`Found ${this.registeredClasses.size} registered classes to process`);
            
            // Process each registered controller
            for (const constructor of this.registeredClasses) {
                const metadata = this.extractMetadata(constructor);
                
                if (metadata && metadata.type === 'controller') {
                    logger?.debug(`Processing controller: ${String(metadata.identifier)}`);
                    await this.processControllerRoutes(container, constructor, metadata, serverWrapper, logger);
                } else {
                    logger?.debug(`Skipping non-controller: ${constructor.name} (type: ${metadata?.type || 'unknown'})`);
                }
            }
            
            logger?.info('✅ Route decorators processed successfully');
            
        } catch (error) {
            logger?.error('Failed to process route decorators:', error);
            logger?.error('Error details:', {
                message: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined
            });
            throw error;
        }
    }

    /**
     * Process routes for a single controller
     */
    private static async processControllerRoutes(
        container: Container,
        constructor: any,
        metadata: InjectableMetadata,
        serverWrapper: any,
        logger?: Logger
    ): Promise<void> {
        try {
            // Get the controller instance from container
            const controllerInstance = container.resolve(metadata.identifier);
            
            if (!controllerInstance) {
                logger?.warn(`Controller ${String(metadata.identifier)} not found in container`);
                return;
            }
            
            // Import MetadataUtils to properly extract route information
            const { MetadataUtils } = await import('./decorators/MetadataUtils');
            
            // Get route information using MetadataUtils
            const { classMetadata, routes } = MetadataUtils.extractRouteInfo(constructor);
            
            logger?.debug(`Processing ${routes.length} routes for controller ${String(metadata.identifier)}`);
            
            // Register each route
            for (const route of routes) {
                const fullPath = MetadataUtils.getFullPath(classMetadata, route.path);
                await this.registerRoute(serverWrapper, route.method, fullPath, controllerInstance, route.handler, logger);
                logger?.debug(`Registered route: ${route.method.toUpperCase()} ${fullPath} -> ${route.handler}`);
            }
            
            if (routes.length > 0) {
                logger?.info(`✅ Registered ${routes.length} routes for controller ${String(metadata.identifier)}`);
            }
            
        } catch (error) {
            logger?.error(`Failed to process routes for controller ${String(metadata.identifier)}:`, error);
            throw error;
        }
    }

    /**
     * Register a single route
     */
    private static async registerRoute(
        serverWrapper: any,
        httpMethod: 'get' | 'post' | 'put' | 'delete' | 'patch',
        path: string,
        controllerInstance: any,
        methodName: string,
        logger?: Logger
    ): Promise<void> {
        try {
            const handler = async (req: any, res: any) => {
                // Create context compatible with MiddlewareContext but adapted for our needs
                const context = {
                    req,
                    res,
                    url: req.getUrl ? req.getUrl() : req.url || path,
                    method: httpMethod.toUpperCase(),
                    headers: req.getHeaders ? req.getHeaders() : req.headers || {},
                    params: req.params || {},
                    query: req.getQuery ? { query: req.getQuery() } : req.query || {},
                    body: req.body || {},
                    requestId: Math.random().toString(36).substring(2, 15),
                    data: {} // MiddlewareContext requirement
                };
                
                try {
                    await controllerInstance[methodName](context);
                } catch (handlerError) {
                    logger?.error(`Route handler error for ${httpMethod.toUpperCase()} ${path}:`, handlerError);
                    // Send error response if not already sent
                    if (!res.aborted && res.writeStatus) {
                        res.writeStatus('500 Internal Server Error');
                        res.writeHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ error: 'Internal Server Error' }));
                    }
                }
            };
            
            // Register route based on HTTP method using UWebSocketWrapper's addHttpHandler method
            serverWrapper.addHttpHandler(httpMethod as 'get' | 'post' | 'put' | 'delete', path, handler, false);
            
            logger?.info(`🛤️ Route registered: ${httpMethod.toUpperCase()} ${path} -> ${controllerInstance.constructor.name}.${methodName}`);
            
        } catch (error) {
            logger?.error(`Failed to register route ${httpMethod.toUpperCase()} ${path}:`, error);
            throw error;
        }
    }

    // ...existing code...
}

/**
 * Modern decorators
 */

/**
 * Base injectable decorator
 */
function createInjectableDecorator(
    type: InjectableMetadata['type'],
    defaultSingleton: boolean = true
) {
    return function (identifier?: string | symbol, singleton?: boolean) {
        return function <T extends { new (...args: any[]): {} }>(constructor: T) {
            const metadata: InjectableMetadata = {
                identifier: identifier || constructor.name,
                singleton: singleton !== undefined ? singleton : defaultSingleton,
                type
            };
            
            Reflect.defineMetadata(INJECTABLE_KEY, metadata, constructor);
            
            // Auto-register the class
            AutoRegistration.registerClass(constructor);
            
            return constructor;
        };
    };
}

// Export modern decorators
export const Service = createInjectableDecorator('service', true);
export const Controller = createInjectableDecorator('controller', false);
export const Repository = createInjectableDecorator('repository', true);
export const Middleware = createInjectableDecorator('middleware', true);
export const Component = createInjectableDecorator('component', true);

/**
 * Generic Injectable decorator
 */
export function Injectable(identifier?: string | symbol, singleton: boolean = true) {
    return Component(identifier, singleton);
}

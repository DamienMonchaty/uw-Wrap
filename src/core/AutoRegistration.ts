/**
 * Auto-registration system for IoC Container
 * Automatically discovers and registers services based on specialized decorators
 */

import 'reflect-metadata';
import { Container, ServiceIdentifier } from './IocContainer';

const INJECTABLE_KEY = Symbol('injectable');

interface InjectableMetadata {
    identifier: ServiceIdentifier;
    singleton: boolean;
    type: 'service' | 'controller' | 'repository' | 'middleware' | 'component';
}

/**
 * Base injectable decorator (internal use)
 */
function createInjectableDecorator(type: InjectableMetadata['type'], defaultSingleton: boolean = true) {
    return function (identifier?: ServiceIdentifier, singleton?: boolean) {
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

/**
 * @Service - For business logic services (singleton by default)
 * Usage: @Service('UserService') or @Service()
 */
export const Service = createInjectableDecorator('service', true);

/**
 * @Controller - For HTTP request handlers (transient by default for handlers)
 * Usage: @Controller('UserController') or @Controller()
 */
export const Controller = createInjectableDecorator('controller', false);

/**
 * @Repository - For data access layer (singleton by default)
 * Usage: @Repository('UserRepository') or @Repository()
 */
export const Repository = createInjectableDecorator('repository', true);

/**
 * @Middleware - For middleware components (singleton by default)
 * Usage: @Middleware('AuthMiddleware') or @Middleware()
 */
export const Middleware = createInjectableDecorator('middleware', true);

/**
 * @Component - Generic component (singleton by default)
 * Usage: @Component('MyComponent') or @Component()
 */
export const Component = createInjectableDecorator('component', true);

/**
 * Legacy @Injectable decorator (for backwards compatibility)
 */
export function Injectable(identifier?: ServiceIdentifier, singleton: boolean = true) {
    return Component(identifier, singleton);
}

/**
 * Auto-register all decorated classes in the container
 */
export class AutoRegistration {
    private static registeredClasses = new Set<any>();

    /**
     * Register a class for auto-discovery
     */
    static registerClass(constructor: any): void {
        this.registeredClasses.add(constructor);
    }

    /**
     * Auto-register all discovered classes
     */
    static autoRegister(container: Container): { services: number; controllers: number; repositories: number; middlewares: number; components: number } {
        const stats = {
            services: 0,
            controllers: 0,
            repositories: 0,
            middlewares: 0,
            components: 0
        };

        for (const constructor of this.registeredClasses) {
            const type = this.registerSingleClass(container, constructor);
            if (type) {
                stats[type + 's' as keyof typeof stats]++;
            }
        }

        return stats;
    }

    private static registerSingleClass(container: Container, constructor: any): string | null {
        const metadata: InjectableMetadata = Reflect.getMetadata(INJECTABLE_KEY, constructor);
        if (!metadata) return null;

        const { identifier, singleton, type } = metadata;
        
        const factory = () => {
            // Get constructor parameters
            const paramTypes = Reflect.getMetadata('design:paramtypes', constructor) || [];
            
            // Resolve dependencies
            const args = paramTypes.map((paramType: any) => {
                return this.resolveDependency(container, paramType, constructor.name);
            });

            return new constructor(...args);
        };

        try {
            if (singleton) {
                container.registerSingleton(identifier, factory);
            } else {
                container.registerTransient(identifier, factory);
            }

            return type;
        } catch (error) {
            console.warn(`⚠️ Failed to register ${type} ${String(identifier)}:`, (error as Error).message);
            return null;
        }
    }

    private static resolveDependency(container: Container, paramType: any, consumerName: string): any {
        const typeName = paramType.name || paramType;
        
        try {
            // Try direct resolution (for string-based registrations)
            return container.resolve(typeName);
        } catch (error) {
            // Try TYPES symbols first
            const TYPES = {
                Logger: Symbol.for('Logger'),
                ErrorHandler: Symbol.for('ErrorHandler'),
                JWTManager: Symbol.for('JWTManager'),
                DatabaseProvider: Symbol.for('DatabaseProvider'),
                Config: Symbol.for('Config')
            };

            // Map parameter type names to TYPES symbols
            const typeMapping: Record<string, symbol> = {
                'Logger': TYPES.Logger,
                'ErrorHandler': TYPES.ErrorHandler,
                'JWTManager': TYPES.JWTManager,
                'DatabaseProvider': TYPES.DatabaseProvider,
                'Config': TYPES.Config
            };

            if (typeMapping[typeName]) {
                try {
                    return container.resolve(typeMapping[typeName]);
                } catch (symbolError) {
                    // Continue to next resolution strategy
                }
            }
            
            // Try common service names mapping for string-based services
            const commonMappings: Record<string, string> = {
                'UWebSocketWrapper': 'UWebSocketWrapper',
                'UserService': 'UserService',
                'UserServiceImpl': 'UserService',
                'ProductService': 'ProductService',
                'ProductRepository': 'ProductRepository',
                'ProductEntityRepository': 'ProductRepository', // ← Map ProductEntityRepository to ProductRepository
                'AppRepositoryManager': 'AppRepositoryManager',
                'RepositoryManager': 'RepositoryManager',
                'Object': 'DatabaseProvider' // Fallback for unrecognized interfaces
            };
            
            const mappedName = commonMappings[typeName];
            if (mappedName) {
                try {
                    // If it's "Object" try with DatabaseProvider symbol
                    if (typeName === 'Object' && mappedName === 'DatabaseProvider') {
                        return container.resolve(TYPES.DatabaseProvider);
                    } else {
                        return container.resolve(mappedName);
                    }
                } catch (mappingError) {
                    // Continue to error
                }
            }
            
            throw new Error(`Cannot resolve dependency: ${typeName} for ${consumerName}`);
        }
    }

    /**
     * Get statistics about registered classes
     */
    static getStats(): { total: number; byType: Record<string, number> } {
        const byType: Record<string, number> = {};
        let total = 0;

        for (const constructor of this.registeredClasses) {
            const metadata: InjectableMetadata = Reflect.getMetadata(INJECTABLE_KEY, constructor);
            if (metadata) {
                byType[metadata.type] = (byType[metadata.type] || 0) + 1;
                total++;
            }
        }

        return { total, byType };
    }
}

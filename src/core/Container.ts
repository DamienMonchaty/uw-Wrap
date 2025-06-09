/**
 * Simple Dependency Injection Container
 * Implements Inversion of Control pattern for clean architecture
 */

export type Constructor<T = {}> = new (...args: any[]) => T;
export type Factory<T> = () => T;
export type ServiceIdentifier<T = any> = string | symbol | Constructor<T>;

interface ServiceDefinition<T = any> {
    factory: Factory<T>;
    singleton: boolean;
    instance?: T;
}

export class Container {
    private services = new Map<ServiceIdentifier, ServiceDefinition>();
    private static instance?: Container;

    /**
     * Get singleton instance (optional - you can also create multiple containers)
     */
    static getInstance(): Container {
        if (!Container.instance) {
            Container.instance = new Container();
        }
        return Container.instance;
    }

    /**
     * Register a service as singleton
     */
    registerSingleton<T>(identifier: ServiceIdentifier<T>, factory: Factory<T>): this {
        this.services.set(identifier, {
            factory,
            singleton: true
        });
        return this;
    }

    /**
     * Register a service as transient (new instance each time)
     */
    registerTransient<T>(identifier: ServiceIdentifier<T>, factory: Factory<T>): this {
        this.services.set(identifier, {
            factory,
            singleton: false
        });
        return this;
    }

    /**
     * Register an existing instance
     */
    registerInstance<T>(identifier: ServiceIdentifier<T>, instance: T): this {
        this.services.set(identifier, {
            factory: () => instance,
            singleton: true,
            instance
        });
        return this;
    }

    /**
     * Resolve a service
     */
    resolve<T>(identifier: ServiceIdentifier<T>): T {
        const serviceDefinition = this.services.get(identifier);
        
        if (!serviceDefinition) {
            throw new Error(`Service not registered: ${String(identifier)}`);
        }

        if (serviceDefinition.singleton) {
            if (!serviceDefinition.instance) {
                serviceDefinition.instance = serviceDefinition.factory();
            }
            return serviceDefinition.instance as T;
        }

        return serviceDefinition.factory() as T;
    }

    /**
     * Check if service is registered
     */
    isRegistered<T>(identifier: ServiceIdentifier<T>): boolean {
        return this.services.has(identifier);
    }

    /**
     * Clear all services (useful for testing)
     */
    clear(): void {
        this.services.clear();
    }

    /**
     * Get all registered service identifiers
     */
    getRegisteredServices(): ServiceIdentifier[] {
        return Array.from(this.services.keys());
    }
}

/**
 * Service identifiers (symbols for type safety)
 */
export const TYPES = {
    // Core services
    Logger: Symbol.for('Logger'),
    ErrorHandler: Symbol.for('ErrorHandler'),
    JWTManager: Symbol.for('JWTManager'),
    
    // Database
    DatabaseProvider: Symbol.for('DatabaseProvider'),
    
    // Configuration
    Config: Symbol.for('Config')
} as const;

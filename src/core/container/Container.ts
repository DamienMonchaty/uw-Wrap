/**
 * Advanced IoC Container - Inspired by Inversify and TSyringe
 * Refactored with SOLID principles, debugging, and modern patterns
 */

import { Logger } from "../../utils/logger";


// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export type Constructor<T = {}> = new (...args: any[]) => T;
export type Factory<T> = (container: Container) => T;
export type ServiceIdentifier<T = any> = string | symbol | Constructor<T>;
export type ServiceScope = 'singleton' | 'transient' | 'scoped';

export interface ServiceRegistration<T = any> {
    identifier: ServiceIdentifier<T>;
    factory: Factory<T>;
    scope: ServiceScope;
    dependencies?: ServiceIdentifier[];
    tags?: string[];
    metadata?: Record<string, any>;
}

export interface ContainerOptions {
    /** Enable debug logging for dependency resolution */
    enableDebug?: boolean;
    /** Logger instance for debug output */
    logger?: Logger;
    /** Enable circular dependency detection */
    detectCircularDependencies?: boolean;
    /** Maximum resolution depth to prevent infinite loops */
    maxResolutionDepth?: number;
}

export interface ResolutionContext {
    path: ServiceIdentifier[];
    depth: number;
    scopedInstances?: Map<ServiceIdentifier, any>;
}

// ============================================================================
// EXCEPTIONS
// ============================================================================

export class ContainerError extends Error {
    constructor(message: string, public context?: any) {
        super(message);
        this.name = 'ContainerError';
    }
}

export class ServiceNotFoundError extends ContainerError {
    constructor(identifier: ServiceIdentifier, availableServices?: ServiceIdentifier[]) {
        const message = `Service not registered: ${String(identifier)}`;
        const context = availableServices ? { availableServices: availableServices.map(s => String(s)) } : undefined;
        super(message, context);
        this.name = 'ServiceNotFoundError';
    }
}

export class CircularDependencyError extends ContainerError {
    constructor(path: ServiceIdentifier[]) {
        const pathString = path.map(id => String(id)).join(' -> ');
        super(`Circular dependency detected: ${pathString}`, { dependencyPath: path });
        this.name = 'CircularDependencyError';
    }
}

// ============================================================================
// CONTAINER IMPLEMENTATION
// ============================================================================

export class Container {
    private registrations = new Map<ServiceIdentifier, ServiceRegistration>();
    private singletonInstances = new Map<ServiceIdentifier, any>();
    private options: Required<ContainerOptions>;
    private static defaultInstance?: Container;

    constructor(options: ContainerOptions = {}) {
        this.options = {
            enableDebug: false,
            logger: new Logger(),
            detectCircularDependencies: true,
            maxResolutionDepth: 50,
            ...options
        };
    }

    /**
     * Get or create default container instance
     */
    static getDefault(): Container {
        if (!Container.defaultInstance) {
            Container.defaultInstance = new Container();
        }
        return Container.defaultInstance;
    }

    /**
     * Set the default container instance
     */
    static setDefault(container: Container): void {
        Container.defaultInstance = container;
    }

    // ============================================================================
    // REGISTRATION METHODS
    // ============================================================================

    /**
     * Register a service with full configuration
     */
    register<T>(registration: ServiceRegistration<T>): this {
        this.debug(`Registering service: ${String(registration.identifier)} (${registration.scope})`);
        
        this.registrations.set(registration.identifier, registration);
        
        // Clear singleton instance if re-registering
        if (this.singletonInstances.has(registration.identifier)) {
            this.singletonInstances.delete(registration.identifier);
        }
        
        return this;
    }

    /**
     * Register a singleton service
     */
    registerSingleton<T>(
        identifier: ServiceIdentifier<T>, 
        factory: Factory<T>,
        options?: Partial<Pick<ServiceRegistration<T>, 'dependencies' | 'tags' | 'metadata'>>
    ): this {
        return this.register({
            identifier,
            factory,
            scope: 'singleton',
            ...options
        });
    }

    /**
     * Register a transient service (new instance each time)
     */
    registerTransient<T>(
        identifier: ServiceIdentifier<T>, 
        factory: Factory<T>,
        options?: Partial<Pick<ServiceRegistration<T>, 'dependencies' | 'tags' | 'metadata'>>
    ): this {
        return this.register({
            identifier,
            factory,
            scope: 'transient',
            ...options
        });
    }

    /**
     * Register a scoped service (one instance per resolution scope)
     */
    registerScoped<T>(
        identifier: ServiceIdentifier<T>, 
        factory: Factory<T>,
        options?: Partial<Pick<ServiceRegistration<T>, 'dependencies' | 'tags' | 'metadata'>>
    ): this {
        return this.register({
            identifier,
            factory,
            scope: 'scoped',
            ...options
        });
    }

    /**
     * Register an existing instance
     */
    registerInstance<T>(identifier: ServiceIdentifier<T>, instance: T): this {
        this.debug(`Registering instance: ${String(identifier)}`);
        
        this.registrations.set(identifier, {
            identifier,
            factory: () => instance,
            scope: 'singleton'
        });
        
        this.singletonInstances.set(identifier, instance);
        return this;
    }

    /**
     * Register a class constructor with automatic dependency injection
     */
    registerClass<T>(
        identifier: ServiceIdentifier<T>, 
        constructor: Constructor<T>,
        scope: ServiceScope = 'singleton',
        dependencies: ServiceIdentifier[] = []
    ): this {
        return this.register({
            identifier,
            factory: (container) => {
                const resolvedDeps = dependencies.map(dep => container.resolve(dep));
                return new constructor(...resolvedDeps);
            },
            scope,
            dependencies
        });
    }

    // ============================================================================
    // RESOLUTION METHODS
    // ============================================================================

    /**
     * Resolve a service with full context tracking
     */
    resolve<T>(identifier: ServiceIdentifier<T>, context?: ResolutionContext): T {
        const resolveContext: ResolutionContext = context || {
            path: [],
            depth: 0,
            scopedInstances: new Map()
        };

        // Check resolution depth
        if (resolveContext.depth > this.options.maxResolutionDepth) {
            throw new ContainerError(
                `Maximum resolution depth exceeded (${this.options.maxResolutionDepth}). Possible circular dependency.`,
                { path: resolveContext.path, identifier }
            );
        }

        // Check for circular dependencies
        if (this.options.detectCircularDependencies && resolveContext.path.includes(identifier)) {
            throw new CircularDependencyError([...resolveContext.path, identifier]);
        }

        this.debug(`Resolving: ${String(identifier)} (depth: ${resolveContext.depth})`);

        const registration = this.registrations.get(identifier);
        if (!registration) {
            throw new ServiceNotFoundError(identifier, Array.from(this.registrations.keys()));
        }

        // Update context
        const newContext: ResolutionContext = {
            path: [...resolveContext.path, identifier],
            depth: resolveContext.depth + 1,
            scopedInstances: resolveContext.scopedInstances
        };

        // Handle different scopes
        switch (registration.scope) {
            case 'singleton':
                return this.resolveSingleton(registration, newContext);
            
            case 'scoped':
                return this.resolveScoped(registration, newContext);
            
            case 'transient':
            default:
                return this.resolveTransient(registration, newContext);
        }
    }

    /**
     * Resolve multiple services by tag
     */
    resolveByTag<T>(tag: string): T[] {
        const services: T[] = [];
        
        for (const registration of this.registrations.values()) {
            if (registration.tags?.includes(tag)) {
                services.push(this.resolve(registration.identifier));
            }
        }
        
        return services;
    }

    /**
     * Try to resolve a service, return undefined if not found
     */
    tryResolve<T>(identifier: ServiceIdentifier<T>): T | undefined {
        try {
            return this.resolve(identifier);
        } catch (error) {
            if (error instanceof ServiceNotFoundError) {
                return undefined;
            }
            throw error;
        }
    }

    // ============================================================================
    // SCOPE RESOLUTION HELPERS
    // ============================================================================

    private resolveSingleton<T>(registration: ServiceRegistration<T>, context: ResolutionContext): T {
        if (this.singletonInstances.has(registration.identifier)) {
            const instance = this.singletonInstances.get(registration.identifier);
            this.debug(`Using cached singleton: ${String(registration.identifier)}`);
            return instance;
        }

        this.debug(`Creating singleton: ${String(registration.identifier)}`);
        const instance = registration.factory(this);
        this.singletonInstances.set(registration.identifier, instance);
        return instance;
    }

    private resolveScoped<T>(registration: ServiceRegistration<T>, context: ResolutionContext): T {
        if (!context.scopedInstances) {
            context.scopedInstances = new Map();
        }

        if (context.scopedInstances.has(registration.identifier)) {
            const instance = context.scopedInstances.get(registration.identifier);
            this.debug(`Using scoped instance: ${String(registration.identifier)}`);
            return instance;
        }

        this.debug(`Creating scoped instance: ${String(registration.identifier)}`);
        const instance = registration.factory(this);
        context.scopedInstances.set(registration.identifier, instance);
        return instance;
    }

    private resolveTransient<T>(registration: ServiceRegistration<T>, context: ResolutionContext): T {
        this.debug(`Creating transient instance: ${String(registration.identifier)}`);
        return registration.factory(this);
    }

    // ============================================================================
    // UTILITY METHODS
    // ============================================================================

    /**
     * Check if service is registered
     */
    isRegistered<T>(identifier: ServiceIdentifier<T>): boolean {
        return this.registrations.has(identifier);
    }

    /**
     * Get registration for a service
     */
    getRegistration<T>(identifier: ServiceIdentifier<T>): ServiceRegistration<T> | undefined {
        return this.registrations.get(identifier) as ServiceRegistration<T> | undefined;
    }

    /**
     * Get all registered service identifiers
     */
    getRegisteredServices(): ServiceIdentifier[] {
        return Array.from(this.registrations.keys());
    }

    /**
     * Get services by tag
     */
    getServicesByTag(tag: string): ServiceRegistration[] {
        return Array.from(this.registrations.values())
            .filter(reg => reg.tags?.includes(tag));
    }

    /**
     * Clear all registrations and instances
     */
    clear(): void {
        this.debug('Clearing container');
        this.registrations.clear();
        this.singletonInstances.clear();
    }

    /**
     * Create a child container that inherits from this one
     */
    createChild(options?: ContainerOptions): Container {
        const child = new Container({ ...this.options, ...options });
        
        // Copy registrations to child
        for (const [identifier, registration] of this.registrations) {
            child.registrations.set(identifier, registration);
        }
        
        this.debug('Created child container');
        return child;
    }

    /**
     * Get container statistics
     */
    getStats(): {
        totalRegistrations: number;
        singletonInstances: number;
        servicesByScope: Record<ServiceScope, number>;
        servicesByTag: Record<string, number>;
    } {
        const servicesByScope: Record<ServiceScope, number> = {
            singleton: 0,
            transient: 0,
            scoped: 0
        };

        const servicesByTag: Record<string, number> = {};

        for (const registration of this.registrations.values()) {
            servicesByScope[registration.scope]++;
            
            if (registration.tags) {
                for (const tag of registration.tags) {
                    servicesByTag[tag] = (servicesByTag[tag] || 0) + 1;
                }
            }
        }

        return {
            totalRegistrations: this.registrations.size,
            singletonInstances: this.singletonInstances.size,
            servicesByScope,
            servicesByTag
        };
    }

    // ============================================================================
    // DEBUG HELPERS
    // ============================================================================

    private debug(message: string, context?: any): void {
        if (this.options.enableDebug && this.options.logger) {
            this.options.logger.debug(`[Container] ${message}`, context);
        }
    }

    /**
     * Enable or disable debug logging
     */
    setDebug(enabled: boolean, logger?: Logger): void {
        this.options.enableDebug = enabled;
        if (logger) {
            this.options.logger = logger;
        }
    }

    /**
     * Print dependency tree for debugging
     */
    printDependencyTree(identifier?: ServiceIdentifier): string {
        const lines: string[] = [];
        
        if (identifier) {
            this.printServiceTree(identifier, lines, 0, new Set());
        } else {
            lines.push('Container Dependency Tree:');
            for (const id of this.registrations.keys()) {
                this.printServiceTree(id, lines, 1, new Set());
            }
        }
        
        return lines.join('\n');
    }

    private printServiceTree(
        identifier: ServiceIdentifier, 
        lines: string[], 
        depth: number, 
        visited: Set<ServiceIdentifier>
    ): void {
        const indent = '  '.repeat(depth);
        const registration = this.registrations.get(identifier);
        
        if (!registration) {
            lines.push(`${indent}❌ ${String(identifier)} (not registered)`);
            return;
        }

        const scope = registration.scope.toUpperCase();
        const tags = registration.tags ? ` [${registration.tags.join(', ')}]` : '';
        
        if (visited.has(identifier)) {
            lines.push(`${indent}🔄 ${String(identifier)} (${scope})${tags} (circular)`);
            return;
        }

        lines.push(`${indent}📦 ${String(identifier)} (${scope})${tags}`);
        
        if (registration.dependencies && registration.dependencies.length > 0) {
            visited.add(identifier);
            for (const dep of registration.dependencies) {
                this.printServiceTree(dep, lines, depth + 1, visited);
            }
            visited.delete(identifier);
        }
    }
}

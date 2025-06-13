/**
 * ComponentRegistry - Separated component registration system
 * Single responsibility: Component registration and lifecycle management
 * Completely separated from discovery logic
 */

import 'reflect-metadata';
import { Container, ServiceIdentifier } from '../container/Container';
import { DiscoveredComponent } from './AsyncComponentDiscovery';
import { Logger } from '../../utils/logger';

export interface ComponentMetadata {
    identifier: ServiceIdentifier;
    singleton: boolean;
    type: 'service' | 'controller' | 'repository' | 'middleware' | 'component';
    dependencies?: string[];
    tags?: string[];
    priority?: number;
}

export interface RegistrationResult {
    successful: number;
    failed: number;
    skipped: number;
    errors: Array<{ component: string; error: string }>;
    registeredComponents: Array<{ 
        identifier: ServiceIdentifier; 
        type: string; 
        singleton: boolean;
        filePath: string;
    }>;
}

export interface RegistrationOptions {
    /** Whether to continue registration after errors */
    continueOnError: boolean;
    /** Whether to skip duplicate registrations */
    skipDuplicates: boolean;
    /** Custom dependency resolution strategy */
    dependencyResolver?: DependencyResolver;
    /** Registration filters */
    filters?: RegistrationFilter[];
    /** Pre-registration hooks */
    preRegistrationHooks?: PreRegistrationHook[];
    /** Post-registration hooks */
    postRegistrationHooks?: PostRegistrationHook[];
}

export type DependencyResolver = (
    container: Container,
    paramType: any,
    consumerName: string
) => any;

export type RegistrationFilter = (
    component: DiscoveredComponent,
    metadata: ComponentMetadata | null
) => boolean;

export type PreRegistrationHook = (
    component: DiscoveredComponent,
    metadata: ComponentMetadata
) => Promise<void> | void;

export type PostRegistrationHook = (
    component: DiscoveredComponent,
    metadata: ComponentMetadata,
    success: boolean,
    error?: Error
) => Promise<void> | void;

// Metadata keys
const INJECTABLE_KEY = Symbol('injectable');
const COMPONENT_METADATA_KEY = Symbol('componentMetadata');

/**
 * Enhanced component registration system
 */
export class ComponentRegistry {
    private logger?: Logger;
    private registeredComponents = new Map<ServiceIdentifier, ComponentMetadata>();

    constructor(logger?: Logger) {
        this.logger = logger;
    }

    /**
     * Register discovered components in container
     */
    async registerComponents(
        components: DiscoveredComponent[],
        container: Container,
        options: RegistrationOptions = this.getDefaultOptions()
    ): Promise<RegistrationResult> {
        const result: RegistrationResult = {
            successful: 0,
            failed: 0,
            skipped: 0,
            errors: [],
            registeredComponents: []
        };

        this.logger?.info(`🔄 Starting registration of ${components.length} components...`);

        for (const component of components) {
            try {
                const success = await this.registerSingleComponent(
                    component,
                    container,
                    options,
                    result
                );

                if (success) {
                    result.successful++;
                } else {
                    result.skipped++;
                }

            } catch (error) {
                result.failed++;
                const errorMessage = error instanceof Error ? error.message : String(error);
                result.errors.push({
                    component: component.relativePath,
                    error: errorMessage
                });

                this.logger?.warn(`Failed to register component: ${component.relativePath}`, { error: errorMessage });

                if (!options.continueOnError) {
                    break;
                }
            }
        }

        this.logger?.info(`✅ Registration complete: ${result.successful} successful, ${result.failed} failed, ${result.skipped} skipped`);
        return result;
    }

    /**
     * Register a single component
     */
    private async registerSingleComponent(
        component: DiscoveredComponent,
        container: Container,
        options: RegistrationOptions,
        result: RegistrationResult
    ): Promise<boolean> {
        // Import the component module
        const module = await this.importComponent(component);
        if (!module) {
            return false;
        }

        // Find the main export (class)
        const ComponentClass = this.findComponentClass(module);
        if (!ComponentClass) {
            this.logger?.debug(`No component class found in: ${component.relativePath}`);
            return false;
        }

        // Extract metadata
        const metadata = this.extractMetadata(ComponentClass);
        if (!metadata) {
            this.logger?.debug(`No registration metadata found in: ${component.relativePath}`);
            return false;
        }

        // Apply filters
        if (options.filters && !options.filters.every(filter => filter(component, metadata))) {
            this.logger?.debug(`Component filtered out: ${component.relativePath}`);
            return false;
        }

        // Check for duplicates
        if (options.skipDuplicates && this.registeredComponents.has(metadata.identifier)) {
            this.logger?.debug(`Duplicate component skipped: ${metadata.identifier.toString()}`);
            return false;
        }

        // Run pre-registration hooks
        if (options.preRegistrationHooks) {
            for (const hook of options.preRegistrationHooks) {
                await hook(component, metadata);
            }
        }

        try {
            // Register in container
            await this.performRegistration(ComponentClass, metadata, container, options);

            // Track registration
            this.registeredComponents.set(metadata.identifier, metadata);
            result.registeredComponents.push({
                identifier: metadata.identifier,
                type: metadata.type,
                singleton: metadata.singleton,
                filePath: component.filePath
            });

            // Run post-registration hooks
            if (options.postRegistrationHooks) {
                for (const hook of options.postRegistrationHooks) {
                    await hook(component, metadata, true);
                }
            }

            this.logger?.debug(`✅ Registered ${metadata.type}: ${metadata.identifier.toString()}`);
            return true;

        } catch (error) {
            // Run post-registration hooks with error
            if (options.postRegistrationHooks) {
                for (const hook of options.postRegistrationHooks) {
                    await hook(component, metadata, false, error as Error);
                }
            }
            throw error;
        }
    }

    /**
     * Import component module safely
     */
    private async importComponent(component: DiscoveredComponent): Promise<any> {
        try {
            return await import(component.filePath);
        } catch (error) {
            this.logger?.warn(`Failed to import component: ${component.relativePath}`, { error });
            return null;
        }
    }

    /**
     * Find the main component class in module
     */
    private findComponentClass(module: any): any {
        // Try default export first
        if (module.default && typeof module.default === 'function') {
            return module.default;
        }

        // Try to find a class with metadata
        for (const exportKey of Object.keys(module)) {
            const exportValue = module[exportKey];
            if (typeof exportValue === 'function' && this.hasComponentMetadata(exportValue)) {
                return exportValue;
            }
        }

        // Try to find any class
        for (const exportKey of Object.keys(module)) {
            const exportValue = module[exportKey];
            if (typeof exportValue === 'function' && exportValue.prototype) {
                return exportValue;
            }
        }

        return null;
    }

    /**
     * Check if class has component metadata
     */
    private hasComponentMetadata(constructor: any): boolean {
        return Reflect.hasMetadata(INJECTABLE_KEY, constructor) ||
               Reflect.hasMetadata(COMPONENT_METADATA_KEY, constructor);
    }

    /**
     * Extract component metadata
     */
    private extractMetadata(constructor: any): ComponentMetadata | null {
        // Try new metadata format first
        const metadata = Reflect.getMetadata(COMPONENT_METADATA_KEY, constructor);
        if (metadata) {
            return metadata;
        }

        // Try legacy format
        const legacyMetadata = Reflect.getMetadata(INJECTABLE_KEY, constructor);
        if (legacyMetadata) {
            return {
                identifier: legacyMetadata.identifier || constructor.name,
                singleton: legacyMetadata.singleton !== false,
                type: legacyMetadata.type || 'component',
                dependencies: [],
                tags: [],
                priority: 0
            };
        }

        return null;
    }

    /**
     * Perform the actual container registration
     */
    private async performRegistration(
        ComponentClass: any,
        metadata: ComponentMetadata,
        container: Container,
        options: RegistrationOptions
    ): Promise<void> {
        const factory = () => {
            // Get constructor parameters
            const paramTypes = Reflect.getMetadata('design:paramtypes', ComponentClass) || [];
            
            // Resolve dependencies
            const args = paramTypes.map((paramType: any) => {
                if (options.dependencyResolver) {
                    return options.dependencyResolver(container, paramType, ComponentClass.name);
                } else {
                    return this.defaultDependencyResolver(container, paramType, ComponentClass.name);
                }
            });

            return new ComponentClass(...args);
        };

        // Register based on singleton preference
        if (metadata.singleton) {
            container.registerSingleton(metadata.identifier, factory);
        } else {
            container.registerTransient(metadata.identifier, factory);
        }
    }

    /**
     * Default dependency resolution strategy
     */
    private defaultDependencyResolver(container: Container, paramType: any, consumerName: string): any {
        const typeName = paramType.name || paramType;
        
        try {
            // Try direct resolution first
            return container.resolve(typeName);
        } catch (error) {
            // Try common type mappings
            const typeMapping = this.getCommonTypeMappings();
            
            if (typeMapping[typeName]) {
                try {
                    return container.resolve(typeMapping[typeName]);
                } catch (mappingError) {
                    // Continue to error
                }
            }
            
            throw new Error(`Cannot resolve dependency: ${typeName} for ${consumerName}`);
        }
    }

    /**
     * Get common type mappings for dependency resolution
     */
    private getCommonTypeMappings(): Record<string, symbol | string> {
        return {
            'Logger': Symbol.for('Logger'),
            'ErrorHandler': Symbol.for('ErrorHandler'),
            'JWTManager': Symbol.for('JWTManager'),
            'Config': Symbol.for('Config'),
            'UWebSocketWrapper': 'UWebSocketWrapper',
            'UserService': 'UserService',
            'ProductService': 'ProductService',
            'ProductRepository': 'ProductRepository',
            'AppRepositoryManager': 'AppRepositoryManager'
        };
    }

    /**
     * Get default registration options
     */
    private getDefaultOptions(): RegistrationOptions {
        return {
            continueOnError: true,
            skipDuplicates: true,
            filters: [
                // Skip test files
                (component) => !component.relativePath.includes('.test.') && 
                              !component.relativePath.includes('.spec.')
            ]
        };
    }

    /**
     * Get registration statistics
     */
    getRegistrationStats(): {
        totalRegistered: number;
        byType: Record<string, number>;
        byLifetime: Record<string, number>;
    } {
        const byType: Record<string, number> = {};
        const byLifetime: Record<string, number> = {};
        let totalRegistered = 0;

        for (const metadata of this.registeredComponents.values()) {
            byType[metadata.type] = (byType[metadata.type] || 0) + 1;
            byLifetime[metadata.singleton ? 'singleton' : 'transient'] = 
                (byLifetime[metadata.singleton ? 'singleton' : 'transient'] || 0) + 1;
            totalRegistered++;
        }

        return { totalRegistered, byType, byLifetime };
    }

    /**
     * Clear registration cache (useful for testing)
     */
    clearRegistrations(): void {
        this.registeredComponents.clear();
    }

    /**
     * Get registered component metadata
     */
    getComponentMetadata(identifier: ServiceIdentifier): ComponentMetadata | undefined {
        return this.registeredComponents.get(identifier);
    }

    /**
     * Check if component is registered
     */
    isRegistered(identifier: ServiceIdentifier): boolean {
        return this.registeredComponents.has(identifier);
    }
}

/**
 * Enhanced decorators with better metadata support
 */

/**
 * Create enhanced injectable decorator
 */
function createEnhancedDecorator(
    type: ComponentMetadata['type'],
    defaultSingleton: boolean = true
) {
    return function (
        identifier?: ServiceIdentifier,
        options: Partial<ComponentMetadata> = {}
    ) {
        return function <T extends { new (...args: any[]): {} }>(constructor: T) {
            const metadata: ComponentMetadata = {
                identifier: identifier || constructor.name,
                singleton: options.singleton !== undefined ? options.singleton : defaultSingleton,
                type,
                dependencies: options.dependencies || [],
                tags: options.tags || [],
                priority: options.priority || 0,
                ...options
            };
            
            Reflect.defineMetadata(COMPONENT_METADATA_KEY, metadata, constructor);
            return constructor;
        };
    };
}

// Enhanced decorators
export const EnhancedService = createEnhancedDecorator('service', true);
export const EnhancedController = createEnhancedDecorator('controller', false);
export const EnhancedRepository = createEnhancedDecorator('repository', true);
export const EnhancedMiddleware = createEnhancedDecorator('middleware', true);
export const EnhancedComponent = createEnhancedDecorator('component', true);

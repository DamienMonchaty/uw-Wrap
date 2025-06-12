/**
 * Container Builder - Fluent API for container configuration
 * Simplifies container setup and service registration
 */

import { Container, ContainerOptions } from './Container';
import { ServiceRegistry, ServiceConfiguration, RegistryOptions } from './ServiceRegistry';
import { SERVICE_TYPES, SERVICE_TAGS } from './ServiceTypes';
import { Logger } from '../../utils/logger';

// ============================================================================
// INTERFACES
// ============================================================================

export interface BuilderOptions extends ContainerOptions, RegistryOptions {
    /** Automatically configure common services */
    autoConfigureCommon?: boolean;
    /** Enable development mode with extra debugging */
    developmentMode?: boolean;
}

export interface ContainerBuildResult {
    /** The configured container */
    container: Container;
    /** The service registry used */
    registry: ServiceRegistry;
    /** Registration statistics */
    stats: {
        totalServices: number;
        coreServices: number;
        userServices: number;
        registrationDuration: number;
    };
}

// ============================================================================
// CONTAINER BUILDER
// ============================================================================

export class ContainerBuilder {
    private container: Container;
    private registry: ServiceRegistry;
    private configurations: ServiceConfiguration[] = [];
    private options: BuilderOptions;

    constructor(options: BuilderOptions = {}) {
        this.options = {
            enableDebug: false,
            detectCircularDependencies: true,
            maxResolutionDepth: 50,
            autoRegisterCore: true,
            validateRegistrations: true,
            autoConfigureCommon: true,
            developmentMode: false,
            ...options
        };

        // Enable debug in development mode
        if (this.options.developmentMode) {
            this.options.enableDebug = true;
        }

        // Create container and registry
        this.container = new Container({
            enableDebug: this.options.enableDebug,
            logger: this.options.logger,
            detectCircularDependencies: this.options.detectCircularDependencies,
            maxResolutionDepth: this.options.maxResolutionDepth
        });

        this.registry = new ServiceRegistry({
            enableDebug: this.options.enableDebug,
            logger: this.options.logger,
            autoRegisterCore: this.options.autoRegisterCore,
            validateRegistrations: this.options.validateRegistrations
        });
    }

    // ============================================================================
    // FLUENT REGISTRATION API
    // ============================================================================

    /**
     * Register application configuration
     */
    withConfig<T>(config: T): this {
        this.container.registerInstance(SERVICE_TYPES.Config, config);
        return this;
    }

    /**
     * Register a singleton service
     */
    singleton<T>(
        identifier: symbol | string,
        factory: (container: Container) => T,
        options?: Partial<ServiceConfiguration>
    ): this {
        this.configurations.push({
            identifier,
            factory,
            scope: 'singleton',
            ...options
        });
        return this;
    }

    /**
     * Register a transient service
     */
    transient<T>(
        identifier: symbol | string,
        factory: (container: Container) => T,
        options?: Partial<ServiceConfiguration>
    ): this {
        this.configurations.push({
            identifier,
            factory,
            scope: 'transient',
            ...options
        });
        return this;
    }

    /**
     * Register a scoped service
     */
    scoped<T>(
        identifier: symbol | string,
        factory: (container: Container) => T,
        options?: Partial<ServiceConfiguration>
    ): this {
        this.configurations.push({
            identifier,
            factory,
            scope: 'scoped',
            ...options
        });
        return this;
    }

    /**
     * Register an instance
     */
    instance<T>(identifier: symbol | string, instance: T): this {
        this.container.registerInstance(identifier, instance);
        return this;
    }

    /**
     * Register a class with automatic dependency injection
     */
    class<T>(
        identifier: symbol | string,
        constructor: new (...args: any[]) => T,
        scope: 'singleton' | 'transient' | 'scoped' = 'singleton',
        dependencies: (symbol | string)[] = []
    ): this {
        this.configurations.push({
            identifier,
            factory: (container) => {
                const resolvedDeps = dependencies.map(dep => container.resolve(dep));
                return new constructor(...resolvedDeps);
            },
            scope,
            dependencies,
            tags: [SERVICE_TAGS.AUTO_DISCOVERED]
        });
        return this;
    }

    /**
     * Configure services by tag
     */
    configureByTag(tag: string, configurator: (config: ServiceConfiguration) => void): this {
        for (const config of this.configurations) {
            if (config.tags?.includes(tag)) {
                configurator(config);
            }
        }
        return this;
    }

    /**
     * Add a service configuration directly
     */
    addConfiguration(config: ServiceConfiguration): this {
        this.configurations.push(config);
        return this;
    }

    /**
     * Add multiple service configurations
     */
    addConfigurations(configs: ServiceConfiguration[]): this {
        this.configurations.push(...configs);
        return this;
    }

    // ============================================================================
    // COMMON SERVICE CONFIGURATIONS
    // ============================================================================

    /**
     * Configure common middleware services
     */
    withMiddleware(): this {
        if (!this.options.autoConfigureCommon) return this;

        // Add common middleware configurations
        this.configurations.push(
            {
                identifier: 'CorsMiddleware',
                factory: (container) => {
                    const { CorsMiddleware } = require('../../middleware/CorsMiddleware');
                    const config = container.resolve(SERVICE_TYPES.Config);
                    return new CorsMiddleware((config as { cors: unknown }).cors);
                },
                scope: 'singleton',
                dependencies: [SERVICE_TYPES.Config],
                tags: [SERVICE_TAGS.MIDDLEWARE, SERVICE_TAGS.INFRASTRUCTURE]
            },
            {
                identifier: 'LoggingMiddleware',
                factory: (container) => {
                    const { LoggingMiddleware } = require('../../middleware/LoggingMiddleware');
                    const logger = container.resolve<Logger>(SERVICE_TYPES.Logger);
                    return new LoggingMiddleware(logger);
                },
                scope: 'singleton',
                dependencies: [SERVICE_TYPES.Logger],
                tags: [SERVICE_TAGS.MIDDLEWARE, SERVICE_TAGS.LOGGING]
            }
        );

        return this;
    }

    /**
     * Configure health check services
     */
    withHealthChecks(): this {
        if (!this.options.autoConfigureCommon) return this;

        this.configurations.push({
            identifier: SERVICE_TYPES.HealthCheckService,
            factory: (container) => {
                const { HealthCheckService } = require('../health/HealthCheckService');
                const logger = container.resolve<Logger>(SERVICE_TYPES.Logger);
                return new HealthCheckService(logger);
            },
            scope: 'singleton',
            dependencies: [SERVICE_TYPES.Logger],
            tags: [SERVICE_TAGS.HEALTH, SERVICE_TAGS.INFRASTRUCTURE]
        });

        return this;
    }

    /**
     * Configure metrics services
     */
    withMetrics(): this {
        if (!this.options.autoConfigureCommon) return this;

        this.configurations.push({
            identifier: SERVICE_TYPES.MetricsService,
            factory: (container) => {
                const { MetricsService } = require('../metrics/MetricsService');
                const logger = container.resolve<Logger>(SERVICE_TYPES.Logger);
                return new MetricsService(logger);
            },
            scope: 'singleton',
            dependencies: [SERVICE_TYPES.Logger],
            tags: [SERVICE_TAGS.METRICS, SERVICE_TAGS.INFRASTRUCTURE]
        });

        return this;
    }

    /**
     * Configure caching services
     */
    withCache(): this {
        if (!this.options.autoConfigureCommon) return this;

        this.configurations.push({
            identifier: SERVICE_TYPES.CacheManager,
            factory: (container) => {
                const { CacheManager } = require('../cache/CacheManager');
                const logger = container.resolve<Logger>(SERVICE_TYPES.Logger);
                return new CacheManager({ logger });
            },
            scope: 'singleton',
            dependencies: [SERVICE_TYPES.Logger],
            tags: [SERVICE_TAGS.CACHE, SERVICE_TAGS.INFRASTRUCTURE]
        });

        return this;
    }

    // ============================================================================
    // DEVELOPMENT HELPERS
    // ============================================================================

    /**
     * Enable development mode with extra debugging
     */
    developmentMode(): this {
        this.options.developmentMode = true;
        this.options.enableDebug = true;
        
        // Enable debug on container and registry
        if (this.options.logger) {
            this.container.setDebug(true, this.options.logger);
        }

        return this;
    }

    /**
     * Add a logger for debugging
     */
    withLogger(logger: Logger): this {
        this.options.logger = logger;
        this.container.setDebug(this.options.enableDebug || false, logger);
        return this;
    }

    /**
     * Configure for testing (disable some features, enable debugging)
     */
    forTesting(): this {
        this.options.enableDebug = true;
        this.options.validateRegistrations = true;
        this.options.detectCircularDependencies = true;
        this.options.autoConfigureCommon = false;
        return this;
    }

    // ============================================================================
    // BUILD METHODS
    // ============================================================================

    /**
     * Build the container with all configurations
     */
    build(): ContainerBuildResult {
        const startTime = Date.now();

        // Register all configurations with the registry
        this.registry.registerMany(this.configurations);

        // Apply registry to container
        const registrationResult = this.registry.applyToContainer(this.container);

        const buildTime = Date.now() - startTime;

        const result: ContainerBuildResult = {
            container: this.container,
            registry: this.registry,
            stats: {
                totalServices: registrationResult.registered,
                coreServices: this.registry.getConfigurationsByTag(SERVICE_TAGS.CORE).length,
                userServices: registrationResult.registered - this.registry.getConfigurationsByTag(SERVICE_TAGS.CORE).length,
                registrationDuration: buildTime
            }
        };

        // Log build results in development mode
        if (this.options.developmentMode && this.options.logger) {
            this.options.logger.info('Container build completed', {
                stats: result.stats,
                failed: registrationResult.failed.length,
                skipped: registrationResult.skipped.length
            });

            if (registrationResult.failed.length > 0) {
                this.options.logger.warn('Failed to register services:', 
                    registrationResult.failed.map(f => ({ service: String(f.identifier), error: f.error.message }))
                );
            }

            // Print dependency tree in development
            this.options.logger.debug('Dependency tree:\n' + this.container.printDependencyTree());
        }

        return result;
    }

    /**
     * Build and return just the container
     */
    buildContainer(): Container {
        return this.build().container;
    }

    /**
     * Get the current container (before build)
     */
    getContainer(): Container {
        return this.container;
    }

    /**
     * Get the current registry (before build)
     */
    getRegistry(): ServiceRegistry {
        return this.registry;
    }

    // ============================================================================
    // STATIC FACTORY METHODS
    // ============================================================================

    /**
     * Create a new builder with default settings
     */
    static create(options?: BuilderOptions): ContainerBuilder {
        return new ContainerBuilder(options);
    }

    /**
     * Create a builder for development with debugging enabled
     */
    static forDevelopment(logger?: Logger): ContainerBuilder {
        return new ContainerBuilder({
            developmentMode: true,
            enableDebug: true,
            logger
        });
    }

    /**
     * Create a builder for production with optimized settings
     */
    static forProduction(): ContainerBuilder {
        return new ContainerBuilder({
            enableDebug: false,
            validateRegistrations: false,
            autoConfigureCommon: true
        });
    }

    /**
     * Create a builder for testing
     */
    static forTesting(): ContainerBuilder {
        return new ContainerBuilder({
            enableDebug: true,
            validateRegistrations: true,
            autoConfigureCommon: false,
            autoRegisterCore: false
        });
    }
}

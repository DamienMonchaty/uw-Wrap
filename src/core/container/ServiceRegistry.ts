/**
 * Service Registry - Refactored with SOLID principles
 * Single Responsibility: Service registration and configuration management
 * Separated from Container for better separation of concerns
 */

import { Container } from './Container';
import { SERVICE_TYPES, SERVICE_TAGS, ServiceTypeMap } from './ServiceTypes';
import { Logger } from '../../utils/logger';
import { ErrorHandler } from '../../utils/errorHandler';
import { 
    ServiceConfig, 
    ServiceConfigItem, 
    ServiceConfigBuilder, 
    DEFAULT_SERVICE_CONFIG,
    createServiceConfigurations 
} from './ServiceConfig';

// ============================================================================
// INTERFACES
// ============================================================================

export interface ServiceConfiguration {
    /** Service identifier */
    identifier: symbol | string;
    /** Service implementation factory */
    factory: (container: Container) => any;
    /** Service scope */
    scope?: 'singleton' | 'transient' | 'scoped';
    /** Service dependencies */
    dependencies?: (symbol | string)[];
    /** Service tags for categorization */
    tags?: string[];
    /** Service metadata */
    metadata?: Record<string, any>;
    /** Condition for registration */
    condition?: (container: Container) => boolean;
}

export interface RegistryOptions {
    /** Enable debug logging */
    enableDebug?: boolean;
    /** Logger instance */
    logger?: Logger;
    /** Auto-register core services */
    autoRegisterCore?: boolean;
    /** Validate registrations */
    validateRegistrations?: boolean;
    /** Custom service configuration */
    serviceConfig?: ServiceConfig;
}

export interface RegistrationResult {
    /** Number of services registered */
    registered: number;
    /** Services that failed registration */
    failed: Array<{ identifier: symbol | string; error: Error }>;
    /** Services that were skipped due to conditions */
    skipped: Array<{ identifier: symbol | string; reason: string }>;
    /** Registration duration in milliseconds */
    duration: number;
}

// ============================================================================
// SERVICE REGISTRY
// ============================================================================

export class ServiceRegistry {
    private configurations = new Map<symbol | string, ServiceConfiguration>();
    private options: Required<RegistryOptions>;
    private serviceConfig: ServiceConfig;

    constructor(options: RegistryOptions = {}) {
        this.options = {
            enableDebug: false,
            logger: new Logger(),
            autoRegisterCore: true,
            validateRegistrations: true,
            serviceConfig: DEFAULT_SERVICE_CONFIG,
            ...options
        };
        
        this.serviceConfig = options.serviceConfig || DEFAULT_SERVICE_CONFIG;

        if (this.options.autoRegisterCore) {
            this.registerCoreServicesFromConfig();
        }
    }

    // ============================================================================
    // REGISTRATION METHODS
    // ============================================================================

    /**
     * Register a single service configuration
     */
    register(config: ServiceConfiguration): this {
        this.debug(`Registering service configuration: ${String(config.identifier)}`);

        if (this.options.validateRegistrations) {
            this.validateConfiguration(config);
        }

        this.configurations.set(config.identifier, config);
        return this;
    }

    /**
     * Register multiple service configurations
     */
    registerMany(configs: ServiceConfiguration[]): this {
        for (const config of configs) {
            this.register(config);
        }
        return this;
    }

    /**
     * Register services with the container
     */
    applyToContainer(container: Container): RegistrationResult {
        const startTime = Date.now();
        const result: RegistrationResult = {
            registered: 0,
            failed: [],
            skipped: [],
            duration: 0
        };

        this.debug(`Applying ${this.configurations.size} service configurations to container`);

        for (const [identifier, config] of this.configurations) {
            try {
                // Check condition
                if (config.condition && !config.condition(container)) {
                    result.skipped.push({
                        identifier,
                        reason: 'Condition not met'
                    });
                    continue;
                }

                // Register with container
                switch (config.scope || 'singleton') {
                    case 'singleton':
                        container.registerSingleton(identifier, config.factory, {
                            dependencies: config.dependencies,
                            tags: config.tags,
                            metadata: config.metadata
                        });
                        break;
                    
                    case 'transient':
                        container.registerTransient(identifier, config.factory, {
                            dependencies: config.dependencies,
                            tags: config.tags,
                            metadata: config.metadata
                        });
                        break;
                    
                    case 'scoped':
                        container.registerScoped(identifier, config.factory, {
                            dependencies: config.dependencies,
                            tags: config.tags,
                            metadata: config.metadata
                        });
                        break;
                }

                result.registered++;
                this.debug(`Successfully registered: ${String(identifier)}`);

            } catch (error) {
                result.failed.push({
                    identifier,
                    error: error as Error
                });
                this.debug(`Failed to register ${String(identifier)}: ${(error as Error).message}`);
            }
        }

        result.duration = Date.now() - startTime;
        
        this.debug(`Registration complete`, {
            registered: result.registered,
            failed: result.failed.length,
            skipped: result.skipped.length,
            duration: result.duration
        });

        return result;
    }

    // ============================================================================
    // SERVICE CONFIG METHODS
    // ============================================================================

    /**
     * Update service configuration
     */
    updateServiceConfig(newConfig: ServiceConfig): void {
        this.serviceConfig = newConfig;
        
        // Clear existing configurations and re-register
        this.clear();
        this.registerCoreServicesFromConfig();
    }

    /**
     * Add custom service to configuration
     */
    addCustomService(category: keyof ServiceConfig, serviceConfig: ServiceConfigItem): void {
        const builder = new ServiceConfigBuilder(this.serviceConfig);
        builder.addService(category, serviceConfig);
        this.serviceConfig = builder.build();
        
        // Register the new service
        const configurations = createServiceConfigurations(this.serviceConfig);
        const newConfig = configurations.find(c => c.identifier === serviceConfig.identifier);
        if (newConfig) {
            this.register(newConfig);
        }
    }

    /**
     * Override existing service configuration
     */
    overrideService(identifier: symbol | string, overrides: Partial<ServiceConfigItem>): void {
        const builder = new ServiceConfigBuilder(this.serviceConfig);
        builder.overrideService(identifier, overrides);
        this.serviceConfig = builder.build();
        
        // Re-register the service
        const configurations = createServiceConfigurations(this.serviceConfig);
        const updatedConfig = configurations.find(c => c.identifier === identifier);
        if (updatedConfig) {
            this.register(updatedConfig);
        }
    }

    /**
     * Get current service configuration
     */
    getServiceConfig(): ServiceConfig {
        return this.serviceConfig;
    }

    // ============================================================================
    // CORE SERVICE REGISTRATION FROM CONFIG
    // ============================================================================

    /**
     * Register core framework services from configuration object
     */
    private registerCoreServicesFromConfig(): void {
        this.debug('Registering core framework services from configuration');

        // Convert service config to service configurations
        const configurations = createServiceConfigurations(this.serviceConfig);
        
        // Register each configuration
        for (const config of configurations) {
            this.register(config);
        }
    }

    // ============================================================================
    // UTILITY METHODS
    // ============================================================================

    /**
     * Check if a service configuration is registered
     */
    hasConfiguration(identifier: symbol | string): boolean {
        return this.configurations.has(identifier);
    }

    /**
     * Get a service configuration
     */
    getConfiguration(identifier: symbol | string): ServiceConfiguration | undefined {
        return this.configurations.get(identifier);
    }

    /**
     * Get all registered configurations
     */
    getAllConfigurations(): ServiceConfiguration[] {
        return Array.from(this.configurations.values());
    }

    /**
     * Get configurations by tag
     */
    getConfigurationsByTag(tag: string): ServiceConfiguration[] {
        return Array.from(this.configurations.values())
            .filter(config => config.tags?.includes(tag));
    }

    /**
     * Clear all configurations
     */
    clear(): void {
        this.debug('Clearing all service configurations');
        this.configurations.clear();
    }

    /**
     * Remove a specific configuration
     */
    remove(identifier: symbol | string): boolean {
        this.debug(`Removing configuration: ${String(identifier)}`);
        return this.configurations.delete(identifier);
    }

    /**
     * Validate a service configuration
     */
    private validateConfiguration(config: ServiceConfiguration): void {
        if (!config.identifier) {
            throw new Error('Service configuration must have an identifier');
        }

        if (!config.factory || typeof config.factory !== 'function') {
            throw new Error(`Service configuration for ${String(config.identifier)} must have a factory function`);
        }

        if (config.scope && !['singleton', 'transient', 'scoped'].includes(config.scope)) {
            throw new Error(`Invalid scope for ${String(config.identifier)}: ${config.scope}`);
        }
    }

    /**
     * Get registry statistics
     */
    getStats(): {
        totalConfigurations: number;
        configurationsByScope: Record<string, number>;
        configurationsByTag: Record<string, number>;
    } {
        const configurationsByScope: Record<string, number> = {
            singleton: 0,
            transient: 0,
            scoped: 0
        };

        const configurationsByTag: Record<string, number> = {};

        for (const config of this.configurations.values()) {
            const scope = config.scope || 'singleton';
            configurationsByScope[scope]++;

            if (config.tags) {
                for (const tag of config.tags) {
                    configurationsByTag[tag] = (configurationsByTag[tag] || 0) + 1;
                }
            }
        }

        return {
            totalConfigurations: this.configurations.size,
            configurationsByScope,
            configurationsByTag
        };
    }

    // ============================================================================
    // DEBUG HELPERS
    // ============================================================================

    private debug(message: string, context?: any): void {
        if (this.options.enableDebug && this.options.logger) {
            this.options.logger.debug(`[ServiceRegistry] ${message}`, context);
        }
    }

    /**
     * Print registry information
     */
    printRegistry(): string {
        const lines: string[] = [];
        lines.push('Service Registry:');
        lines.push(`Total configurations: ${this.configurations.size}`);
        lines.push('');

        for (const [identifier, config] of this.configurations) {
            const scope = config.scope || 'singleton';
            const tags = config.tags ? ` [${config.tags.join(', ')}]` : '';
            const deps = config.dependencies ? ` deps: ${config.dependencies.length}` : '';
            
            lines.push(`📋 ${String(identifier)} (${scope})${tags}${deps}`);
            
            if (config.dependencies && config.dependencies.length > 0) {
                for (const dep of config.dependencies) {
                    lines.push(`   └─ 📦 ${String(dep)}`);
                }
            }
        }

        return lines.join('\n');
    }
}

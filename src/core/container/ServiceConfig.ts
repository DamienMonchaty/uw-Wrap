/**
 * Service Configuration Object - Structured configuration for dependency injection
 * Single Responsibility: Define all service configurations in a declarative way
 */

import { Container } from './Container';
import { SERVICE_TYPES, SERVICE_TAGS } from './ServiceTypes';
import { ServiceConfiguration } from './ServiceRegistry';
import { Logger } from '../../utils/logger';
import { ErrorHandler } from '../../utils/errorHandler';
import { ApplicationConfig } from './ApplicationConfig';

// ============================================================================
// SERVICE CONFIGURATION OBJECT
// ============================================================================

export interface ServiceConfig {
    /** Core framework services */
    core: CoreServicesConfig;
    /** Infrastructure services */
    infrastructure: InfrastructureServicesConfig;
    /** Authentication services */
    auth: AuthServicesConfig;
    /** Database services */
    database: DatabaseServicesConfig;
    /** Application services */
    application: ApplicationServicesConfig;
}

export interface CoreServicesConfig {
    logger: ServiceConfigItem;
    errorHandler: ServiceConfigItem;
    config: ServiceConfigItem;
}

export interface InfrastructureServicesConfig {
    serverWrapper: ServiceConfigItem;
    router: ServiceConfigItem;
    eventManager?: ServiceConfigItem;
}

export interface AuthServicesConfig {
    jwtManager?: ServiceConfigItem;
    authenticationWrapper?: ServiceConfigItem;
}

export interface DatabaseServicesConfig {
    provider?: ServiceConfigItem;
    repositories?: ServiceConfigItem[];
}

export interface ApplicationServicesConfig {
    services?: ServiceConfigItem[];
    handlers?: ServiceConfigItem[];
    middleware?: ServiceConfigItem[];
}

export interface ServiceConfigItem {
    /** Service identifier */
    identifier: symbol | string;
    /** Module path for dynamic loading */
    modulePath?: string;
    /** Class name to instantiate */
    className?: string;
    /** Factory function */
    factory?: (container: Container) => any;
    /** Service scope */
    scope?: 'singleton' | 'transient' | 'scoped';
    /** Dependencies */
    dependencies?: (symbol | string)[];
    /** Tags */
    tags?: string[];
    /** Metadata */
    metadata?: Record<string, any>;
    /** Registration condition */
    condition?: (container: Container) => boolean;
    /** Configuration parameters */
    config?: Record<string, any>;
}

// ============================================================================
// DEFAULT SERVICE CONFIGURATION
// ============================================================================

/**
 * Default service configuration for uW-Wrap framework
 */
export const DEFAULT_SERVICE_CONFIG: ServiceConfig = {
    core: {
        logger: {
            identifier: SERVICE_TYPES.Logger,
            modulePath: '../../utils/logger',
            className: 'Logger',
            scope: 'singleton',
            tags: [SERVICE_TAGS.CORE, SERVICE_TAGS.INFRASTRUCTURE, SERVICE_TAGS.LOGGING],
            factory: () => {
                const { Logger } = require('../../utils/logger');
                return new Logger();
            }
        },
        
        errorHandler: {
            identifier: SERVICE_TYPES.ErrorHandler,
            modulePath: '../../utils/errorHandler',
            className: 'ErrorHandler',
            scope: 'singleton',
            dependencies: [SERVICE_TYPES.Logger],
            tags: [SERVICE_TAGS.CORE, SERVICE_TAGS.INFRASTRUCTURE],
            factory: (container: Container) => {
                const logger = container.resolve<Logger>(SERVICE_TYPES.Logger);
                const { ErrorHandler } = require('../../utils/errorHandler');
                return new ErrorHandler(logger);
            }
        },
        
        config: {
            identifier: SERVICE_TYPES.Config,
            scope: 'singleton',
            tags: [SERVICE_TAGS.CORE, SERVICE_TAGS.CONFIGURATION],
            factory: (container: Container) => {
                // Config should be provided externally
                throw new Error('Config must be registered before other services');
            }
        }
    },
    
    infrastructure: {
        serverWrapper: {
            identifier: SERVICE_TYPES.ServerWrapper,
            modulePath: '../ServerWrapper',
            className: 'UWebSocketWrapper',
            scope: 'singleton',
            dependencies: [SERVICE_TYPES.Config, SERVICE_TYPES.Logger, SERVICE_TYPES.ErrorHandler],
            tags: [SERVICE_TAGS.CORE, SERVICE_TAGS.INFRASTRUCTURE],
            factory: (container: Container) => {
                const config = container.resolve<ApplicationConfig>(SERVICE_TYPES.Config);
                const logger = container.resolve<Logger>(SERVICE_TYPES.Logger);
                const errorHandler = container.resolve<ErrorHandler>(SERVICE_TYPES.ErrorHandler);
                const jwtManager = container.tryResolve(SERVICE_TYPES.JWTManager);
                
                const { UWebSocketWrapper } = require('../ServerWrapper');
                return new UWebSocketWrapper(config.server.port, logger, errorHandler, jwtManager);
            }
        },
        
        router: {
            identifier: SERVICE_TYPES.Router,
            modulePath: '../routing/Router',
            className: 'Router',
            scope: 'singleton',
            dependencies: [
                SERVICE_TYPES.ServerWrapper,
                SERVICE_TYPES.Logger,
                SERVICE_TYPES.ErrorHandler,
                SERVICE_TYPES.Config
            ],
            tags: [SERVICE_TAGS.CORE, SERVICE_TAGS.INFRASTRUCTURE],
            factory: (container: Container) => {
                const wrapper = container.resolve(SERVICE_TYPES.ServerWrapper);
                const logger = container.resolve<Logger>(SERVICE_TYPES.Logger);
                const errorHandler = container.resolve<ErrorHandler>(SERVICE_TYPES.ErrorHandler);
                const config = container.resolve<ApplicationConfig>(SERVICE_TYPES.Config);
                const jwtManager = container.tryResolve(SERVICE_TYPES.JWTManager);
                
                const { Router } = require('../routing/Router');
                return new Router(wrapper, logger, errorHandler, {
                    corsOptions: config.cors,
                    enableLogging: config.logging?.enabled !== false,
                    jwtManager
                });
            }
        }
    },
    
    auth: {
        jwtManager: {
            identifier: SERVICE_TYPES.JWTManager,
            modulePath: '../../auth/JwtManager',
            className: 'JWTManager',
            scope: 'singleton',
            dependencies: [SERVICE_TYPES.Config],
            tags: [SERVICE_TAGS.CORE, SERVICE_TAGS.AUTH],
            condition: (container: Container) => {
                const config = container.tryResolve<ApplicationConfig>(SERVICE_TYPES.Config);
                return !!(config && config.auth?.jwtSecret);
            },
            factory: (container: Container) => {
                const config = container.resolve<ApplicationConfig>(SERVICE_TYPES.Config);
                const { JWTManager } = require('../../auth/JwtManager');
                return new JWTManager(config.auth.jwtSecret, config.auth.jwtExpiresIn);
            }
        }
    },
    
    database: {
        provider: {
            identifier: SERVICE_TYPES.DatabaseProvider,
            scope: 'singleton',
            dependencies: [SERVICE_TYPES.Config, SERVICE_TYPES.Logger, SERVICE_TYPES.ErrorHandler],
            tags: [SERVICE_TAGS.CORE, SERVICE_TAGS.DATABASE],
            condition: (container: Container) => {
                const config = container.tryResolve<ApplicationConfig>(SERVICE_TYPES.Config);
                return !!(config && config.database);
            },
            factory: (container: Container) => {
                const config = container.resolve<ApplicationConfig>(SERVICE_TYPES.Config);
                const logger = container.resolve<Logger>(SERVICE_TYPES.Logger);
                const errorHandler = container.resolve<ErrorHandler>(SERVICE_TYPES.ErrorHandler);
                
                if (config.database.type === 'mysql' && config.database.mysql) {
                    const { MySQLProvider } = require('../../database/providers/MySQLProvider');
                    return new MySQLProvider(config.database.mysql, logger, errorHandler);
                } else if (config.database.type === 'sqlite' && config.database.sqlite) {
                    const { SQLiteProvider } = require('../../database/providers/SQLiteProvider');
                    return new SQLiteProvider(config.database.sqlite.file, logger, errorHandler);
                } else {
                    throw new Error('Invalid database configuration');
                }
            }
        }
    },
    
    application: {
        services: [],
        handlers: [],
        middleware: []
    }
};

// ============================================================================
// SERVICE CONFIGURATION BUILDER
// ============================================================================

export class ServiceConfigBuilder {
    private config: ServiceConfig;
    
    constructor(baseConfig: ServiceConfig = DEFAULT_SERVICE_CONFIG) {
        this.config = JSON.parse(JSON.stringify(baseConfig)); // Deep clone
    }
    
    /**
     * Add custom service configuration
     */
    addService(category: keyof ServiceConfig, serviceConfig: ServiceConfigItem): this {
        if (category === 'application') {
            if (!this.config.application.services) {
                this.config.application.services = [];
            }
            this.config.application.services.push(serviceConfig);
        } else {
            // For other categories, add as property
            (this.config[category] as any)[String(serviceConfig.identifier)] = serviceConfig;
        }
        return this;
    }
    
    /**
     * Override existing service configuration
     */
    overrideService(identifier: symbol | string, overrides: Partial<ServiceConfigItem>): this {
        const service = this.findService(identifier);
        if (service) {
            Object.assign(service, overrides);
        }
        return this;
    }
    
    /**
     * Remove service configuration
     */
    removeService(identifier: symbol | string): this {
        for (const category of Object.values(this.config)) {
            if (Array.isArray(category)) {
                const index = category.findIndex(s => s.identifier === identifier);
                if (index >= 0) {
                    category.splice(index, 1);
                    break;
                }
            } else if (typeof category === 'object') {
                for (const [key, service] of Object.entries(category)) {
                    if (service && typeof service === 'object' && 'identifier' in service && service.identifier === identifier) {
                        delete (category as any)[key];
                        break;
                    }
                }
            }
        }
        return this;
    }
    
    /**
     * Find service configuration by identifier
     */
    private findService(identifier: symbol | string): ServiceConfigItem | undefined {
        for (const category of Object.values(this.config)) {
            if (Array.isArray(category)) {
                const service = category.find(s => s.identifier === identifier);
                if (service) return service;
            } else if (typeof category === 'object') {
                for (const service of Object.values(category)) {
                    if (service && typeof service === 'object' && 'identifier' in service && service.identifier === identifier) {
                        return service as ServiceConfigItem;
                    }
                }
            }
        }
        return undefined;
    }
    
    /**
     * Build final configuration
     */
    build(): ServiceConfig {
        return this.config;
    }
    
    /**
     * Convert to ServiceConfiguration array
     */
    toServiceConfigurations(): ServiceConfiguration[] {
        const configurations: ServiceConfiguration[] = [];
        
        // Process all categories
        for (const [categoryName, category] of Object.entries(this.config)) {
            if (Array.isArray(category)) {
                // Handle arrays (like application services)
                for (const item of category) {
                    configurations.push(this.convertToServiceConfiguration(item));
                }
            } else if (typeof category === 'object') {
                // Handle objects (like core, infrastructure, etc.)
                for (const [serviceName, item] of Object.entries(category)) {
                    if (item && typeof item === 'object' && 'identifier' in item) {
                        configurations.push(this.convertToServiceConfiguration(item as ServiceConfigItem));
                    }
                }
            }
        }
        
        return configurations;
    }
    
    /**
     * Convert ServiceConfigItem to ServiceConfiguration
     */
    private convertToServiceConfiguration(item: ServiceConfigItem): ServiceConfiguration {
        return {
            identifier: item.identifier,
            factory: item.factory || this.createDefaultFactory(item),
            scope: item.scope,
            dependencies: item.dependencies,
            tags: item.tags,
            metadata: item.metadata,
            condition: item.condition
        };
    }
    
    /**
     * Create default factory from module path and class name
     */
    private createDefaultFactory(item: ServiceConfigItem): (container: Container) => any {
        if (item.factory) {
            return item.factory;
        }
        
        if (item.modulePath && item.className) {
            return (container: Container) => {
                const module = require(item.modulePath!);
                const ServiceClass = module[item.className!];
                
                if (!ServiceClass) {
                    throw new Error(`Class ${item.className} not found in module ${item.modulePath}`);
                }
                
                // Resolve dependencies
                const dependencies = item.dependencies ? 
                    item.dependencies.map(dep => container.resolve(dep)) : [];
                
                return new ServiceClass(...dependencies);
            };
        }
        
        throw new Error(`Service ${String(item.identifier)} must have either a factory or modulePath/className`);
    }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create service configuration from object
 */
export function createServiceConfig(overrides: Partial<ServiceConfig> = {}): ServiceConfig {
    return new ServiceConfigBuilder()
        .build();
}

/**
 * Create service configurations from config object
 */
export function createServiceConfigurations(config: ServiceConfig = DEFAULT_SERVICE_CONFIG): ServiceConfiguration[] {
    return new ServiceConfigBuilder(config).toServiceConfigurations();
}

/**
 * Merge service configurations
 */
export function mergeServiceConfigs(base: ServiceConfig, override: Partial<ServiceConfig>): ServiceConfig {
    const builder = new ServiceConfigBuilder(base);
    
    // Apply overrides
    if (override.core) {
        Object.entries(override.core).forEach(([key, service]) => {
            if (service) {
                builder.overrideService(service.identifier, service);
            }
        });
    }
    
    if (override.infrastructure) {
        Object.entries(override.infrastructure).forEach(([key, service]) => {
            if (service) {
                builder.overrideService(service.identifier, service);
            }
        });
    }
    
    if (override.auth) {
        Object.entries(override.auth).forEach(([key, service]) => {
            if (service) {
                builder.overrideService(service.identifier, service);
            }
        });
    }
    
    if (override.database) {
        Object.entries(override.database).forEach(([key, service]) => {
            if (service && typeof service === 'object' && 'identifier' in service) {
                builder.overrideService(service.identifier, service);
            }
        });
    }
    
    if (override.application) {
        if (override.application.services) {
            override.application.services.forEach(service => {
                builder.addService('application', service);
            });
        }
    }
    
    return builder.build();
}

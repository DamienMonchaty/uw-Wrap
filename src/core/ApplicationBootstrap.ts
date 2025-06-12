/**
 * ApplicationBootstrap - Modern version using new container system
 * Single responsibility: Application lifecycle management
 */

import 'dotenv/config';
import { Container } from './container/Container';
import { ContainerBuilder } from './container/ContainerBuilder';
import { SERVICE_TYPES } from './container/ServiceTypes';
import { ApplicationConfig, createDefaultApplicationConfig } from './container/ApplicationConfig';
import { Logger } from '../utils/logger';
import { ModuleLoader } from './bootstrap/ModuleLoader';
import { ServerStarter } from './bootstrap/ServerStarter';
import { AutoDiscovery } from './AutoDiscovery';
import { HealthCheckService } from './health/HealthCheckService';
import { MetricsService } from './metrics/MetricsService';

/**
 * Bootstrap result interface
 */
export interface BootstrapResult {
    container: Container;
    config: ApplicationConfig;
    router: any;
    serverWrapper: any;
}

/**
 * Bootstrap configuration options
 */
export interface BootstrapOptions {
    enableAutoDiscovery?: boolean;
    enableMetrics?: boolean;
    enableHealthCheck?: boolean;
    metricsIntervalMs?: number;
    skipDatabaseInit?: boolean;
    verbose?: boolean;
}

/**
 * Application Bootstrap Class - Modern version using new container system
 * Single responsibility: Application lifecycle management
 */
export class ApplicationBootstrap {
    private containerBuilder: ContainerBuilder;
    private container?: Container;
    private moduleLoader?: ModuleLoader;
    private serverStarter?: ServerStarter;
    private config: ApplicationConfig;
    private logger: Logger;

    constructor(config: ApplicationConfig) {
        // Apply defaults if needed
        this.config = { ...createDefaultApplicationConfig(), ...config };
        this.logger = new Logger();
        
        // Initialize container builder with modern system
        this.containerBuilder = ContainerBuilder.create({
            enableDebug: false, // Disable debug for clean output
            logger: this.logger
        }).withConfig(this.config);
        
        this.logger.info('🔄 ApplicationBootstrap initialized with modern container system');
    }

    /**
     * Start the application using modern architecture
     */
    async start(options: BootstrapOptions = {}): Promise<BootstrapResult> {
        try {
            this.logger.info('🚀 Starting application with modern bootstrap...');

            // 1. Build container with modern system
            const result = this.containerBuilder.build();
            this.container = result.container;

            // 2. Manual registration of core services (temporary fix)
            this.registerCoreServices();

            // 3. Perform auto-discovery
            await this.performAutoDiscovery();

            // 4. Setup module loader
            this.moduleLoader = new ModuleLoader(this.container);
            
            // 4. Setup server lifecycle management
            const wrapper = this.container.resolve(SERVICE_TYPES.ServerWrapper) as any; // Type assertion needed for start method
            this.serverStarter = new ServerStarter(this.moduleLoader, this.logger);

            // 5. Start the actual HTTP server
            await wrapper.start();

            // 6. Start server lifecycle management
            await this.serverStarter.start();

            this.logger.info('✅ Application started successfully with modern architecture');

            return {
                container: this.container,
                config: this.config,
                router: this.container.resolve(SERVICE_TYPES.Router),
                serverWrapper: wrapper
            };
        } catch (error) {
            this.logger.error('❌ Failed to start application:', error);
            throw error;
        }
    }

    /**
     * Manual registration of core services - temporary fix
     */
    private registerCoreServices(): void {
        if (!this.container) {
            throw new Error('Container not initialized');
        }

        // Register Logger
        this.container.registerSingleton(SERVICE_TYPES.Logger, () => {
            const { Logger } = require('../utils/logger');
            return new Logger();
        });

        // Register ErrorHandler
        this.container.registerSingleton(SERVICE_TYPES.ErrorHandler, (container) => {
            const logger = container.resolve(SERVICE_TYPES.Logger);
            const { ErrorHandler } = require('../utils/errorHandler');
            return new ErrorHandler(logger);
        });

        // Register ServerWrapper
        this.container.registerSingleton(SERVICE_TYPES.ServerWrapper, (container) => {
            const config = container.resolve(SERVICE_TYPES.Config) as ApplicationConfig;
            const logger = container.resolve(SERVICE_TYPES.Logger);
            const errorHandler = container.resolve(SERVICE_TYPES.ErrorHandler);
            const { UWebSocketWrapper } = require('./ServerWrapper');
            return new UWebSocketWrapper(config.server.port, logger, errorHandler);
        });

        // Register Router
        this.container.registerSingleton(SERVICE_TYPES.Router, (container) => {
            const logger = container.resolve(SERVICE_TYPES.Logger);
            const { Router } = require('./routing/Router');
            return new Router(logger);
        });

        this.logger.info('✅ Core services registered manually');
    }

    /**
     * Perform auto-discovery of handlers and controllers
     */
    private async performAutoDiscovery(): Promise<void> {
        if (!this.container) {
            throw new Error('Container not initialized');
        }

        try {
            this.logger.info('🔍 Starting auto-registration of decorated components...');
            
            // Use the AutoRegistration system to register decorated components
            const { AutoRegistration } = await import('./AutoRegistration');
            const stats = await AutoRegistration.autoRegister(this.container, {
                continueOnError: true,
                skipDuplicates: true
            }, this.logger);
            
            this.logger.info('✅ Auto-registration completed:', stats);
            
            // Setup routes from discovered handlers
            await this.setupDiscoveredRoutes();
            
        } catch (error) {
            this.logger.warn('Auto-registration failed:', error);
            // Don't attempt fallback manual registration - keep it pure
        }
    }

    /**
     * Setup routes from discovered handlers using decorators
     */
    private async setupDiscoveredRoutes(): Promise<void> {
        if (!this.container) return;

        try {
            this.logger.info('🔗 Processing route decorators from discovered handlers...');
            
            // Use the AutoRegistration system to process route decorators
            const { AutoRegistration } = await import('./AutoRegistration');
            await AutoRegistration.processRouteDecorators(this.container, this.logger);
            
            this.logger.info('✅ Route decorators processed successfully');
            
        } catch (error) {
            this.logger.error('Failed to process route decorators:', error);
            // Simplified fallback: just log the error, don't try manual registration
            this.logger.warn('Routes will not be available - auto-registration failed');
        }
    }

    /**
     * Quick start with minimal configuration
     */
    async quickStart(): Promise<BootstrapResult> {
        return this.start({
            enableAutoDiscovery: true,
            enableMetrics: true,
            enableHealthCheck: true
        });
    }

    /**
     * Get the container (after start)
     */
    getContainer(): Container {
        if (!this.container) {
            throw new Error('Application not started yet. Call start() first.');
        }
        return this.container;
    }

    /**
     * Get health check service
     */
    getHealthCheckService(): HealthCheckService | undefined {
        return this.moduleLoader?.getHealthCheckService();
    }

    /**
     * Get metrics service
     */
    getMetricsService(): MetricsService | undefined {
        return this.moduleLoader?.getMetricsService();
    }

    /**
     * Graceful shutdown
     */
    async shutdown(): Promise<void> {
        if (this.serverStarter) {
            await this.serverStarter.shutdown();
        }
    }

    /**
     * Add custom shutdown handler
     */
    onShutdown(handler: () => Promise<void>): void {
        if (this.serverStarter) {
            this.serverStarter.onShutdown(handler);
        } else {
            throw new Error('Server not started yet. Call start() first.');
        }
    }

    /**
     * Check if shutting down
     */
    isShuttingDown(): boolean {
        return this.serverStarter?.isServerShuttingDown() || false;
    }

    /**
     * Get validated configuration
     */
    getConfig(): ApplicationConfig {
        return this.config;
    }
}

/**
 * Convenience function for quick server startup
 */
export async function startApplication(
    config: ApplicationConfig, 
    options: BootstrapOptions = {}
): Promise<BootstrapResult> {
    const bootstrap = new ApplicationBootstrap(config);
    return await bootstrap.start(options);
}

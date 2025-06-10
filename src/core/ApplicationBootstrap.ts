/**
 * Application Bootstrap - Simplified server startup with auto-discovery
 * Factorizes common server initialization patterns
 */

import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { ServiceRegistry, BaseAppConfig } from './ServiceRegistry';
import { Container } from './IocContainer';
import { DatabaseProvider } from '../database/interfaces/DatabaseProvider';
import { Logger } from '../utils/logger';
import { TYPES } from './IocContainer';
import { HealthCheckService } from './HealthCheck';
import { ConfigValidator } from './ConfigValidator';
import { MetricsService } from './Metrics';

/**
 * Bootstrap configuration options
 */
export interface BootstrapOptions {
    /** Custom schema path (relative to project root) */
    schemaPath?: string;
    /** Skip database initialization */
    skipDatabaseInit?: boolean;
    /** Custom discovery patterns */
    discoveryPatterns?: any;
    /** Enable verbose logging during startup */
    verbose?: boolean;
    /** Enable automatic graceful shutdown handling */
    enableGracefulShutdown?: boolean;
    /** Shutdown timeout in milliseconds */
    shutdownTimeoutMs?: number;
    /** Skip configuration validation */
    skipConfigValidation?: boolean;
    /** Enable built-in health checks */
    enableHealthChecks?: boolean;
    /** Enable metrics collection */
    enableMetrics?: boolean;
    /** Metrics collection interval in milliseconds */
    metricsIntervalMs?: number;
}

/**
 * Application Bootstrap Class
 * Simplifies server startup to a single method call
 */
export class ApplicationBootstrap<TConfig extends BaseAppConfig = BaseAppConfig> {
    private serviceRegistry: ServiceRegistry<TConfig>;
    private container?: Container;
    private shutdownHandlers: (() => Promise<void>)[] = [];
    private isShuttingDown = false;
    private healthCheckService?: HealthCheckService;
    private metricsService?: MetricsService;
    private configValidator: ConfigValidator;

    constructor(config: TConfig) {
        this.configValidator = new ConfigValidator();
        
        // Validate and apply defaults to config
        if (!this.skipValidation(config)) {
            const { config: validatedConfig, validation } = this.configValidator.validateAndApplyDefaults(config);
            
            if (!validation.valid) {
                console.error('❌ Configuration validation failed:');
                console.error(this.configValidator.createReport(validation));
                throw new Error('Invalid configuration');
            }
            
            if (validation.warnings.length > 0) {
                console.warn('⚠️ Configuration warnings:');
                validation.warnings.forEach(warning => console.warn(`  - ${warning}`));
            }
            
            // Type assertion is safe here since we're extending the base config
            config = validatedConfig as TConfig;
        }
        
        this.serviceRegistry = new ServiceRegistry(config);
    }

    private skipValidation(config: any): boolean {
        return config._skipValidation === true;
    }

    /**
     * Start the application with minimal configuration
     * Handles all the boilerplate automatically
     */
    async start(options: BootstrapOptions = {}): Promise<{ container: Container; serviceRegistry: ServiceRegistry<TConfig> }> {
        const startTime = Date.now();
        
        try {
            // 1. Setup application with auto-discovery
            console.log('🚀 Starting uW-Wrap application...');
            const { container } = await this.serviceRegistry.setupApplicationWithAutoDiscovery(options.discoveryPatterns);
            this.container = container;

            // 2. Initialize database if not skipped
            if (!options.skipDatabaseInit) {
                await this.initializeDatabase(options.schemaPath);
            }

            // 3. Setup health checks if enabled
            if (options.enableHealthChecks !== false) {
                this.setupHealthChecks();
            }

            // 4. Setup metrics if enabled
            if (options.enableMetrics !== false) {
                this.setupMetrics(options.metricsIntervalMs);
            }

            // 5. Setup graceful shutdown if enabled (default: true)
            if (options.enableGracefulShutdown !== false) {
                this.setupGracefulShutdown(options.shutdownTimeoutMs);
            }

            // 6. Start the server
            await this.serviceRegistry.startServer();

            // 7. Log success
            const logger = container.resolve<Logger>(TYPES.Logger);
            const duration = Date.now() - startTime;
            logger.info(`🎉 Application started successfully in ${duration}ms`);

            return { container, serviceRegistry: this.serviceRegistry };

        } catch (error) {
            console.error('💥 Failed to start application:', error);
            throw error;
        }
    }

    /**
     * Quick start with minimal configuration
     * Perfect for prototyping and simple applications
     */
    async quickStart(): Promise<{ container: Container; serviceRegistry: ServiceRegistry<TConfig> }> {
        return this.start({
            verbose: true,
            skipDatabaseInit: false  // Auto-detect schema
        });
    }

    /**
     * Initialize database with automatic schema detection
     */
    private async initializeDatabase(customSchemaPath?: string): Promise<void> {
        if (!this.container) {
            throw new Error('Container not initialized');
        }

        const logger = this.container.resolve<Logger>(TYPES.Logger);
        const dbProvider = this.container.resolve<DatabaseProvider>(TYPES.DatabaseProvider);
        
        // Auto-detect schema path
        const schemaPath = customSchemaPath || this.detectSchemaPath();
        
        try {
            // Connect to the database first
            await dbProvider.connect();
            logger.info('✅ Database connected successfully');
            
            // Initialize schema if file exists
            if (schemaPath && fs.existsSync(schemaPath)) {
                const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
                await dbProvider.initializeSchema(schemaContent);
                logger.info('✅ Database schema initialized successfully');
            } else {
                logger.warn('⚠️ No schema file found, skipping schema initialization');
            }
            
        } catch (error) {
            logger.error('❌ Database initialization failed:', { 
                message: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined
            });
            // Continue anyway as tables may already exist
        }
    }

    /**
     * Auto-detect schema file location
     */
    private detectSchemaPath(): string | null {
        const possiblePaths = [
            path.join(process.cwd(), 'schema.sql'),
            path.join(process.cwd(), 'database', 'schema.sql'),
            path.join(process.cwd(), 'db', 'schema.sql'),
            path.join(process.cwd(), 'sql', 'schema.sql'),
        ];

        for (const schemaPath of possiblePaths) {
            if (fs.existsSync(schemaPath)) {
                return schemaPath;
            }
        }

        return null;
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
     * Get the service registry
     */
    getServiceRegistry(): ServiceRegistry<TConfig> {
        return this.serviceRegistry;
    }

    /**
     * Graceful shutdown
     */
    async shutdown(): Promise<void> {
        if (this.isShuttingDown || !this.container) {
            return;
        }

        this.isShuttingDown = true;

        try {
            const logger = this.container.resolve<Logger>(TYPES.Logger);
            logger.info('🛑 Shutting down application...');

            // Execute custom shutdown handlers first
            for (const handler of this.shutdownHandlers) {
                try {
                    await handler();
                } catch (error) {
                    logger.error('Error in shutdown handler:', error);
                }
            }

            // Close database connections
            const dbProvider = this.container.resolve<DatabaseProvider>(TYPES.DatabaseProvider);
            await dbProvider.disconnect();

            logger.info('✅ Application shutdown completed');
        } catch (error) {
            console.error('Error during shutdown:', error);
        }
    }

    /**
     * Setup metrics collection
     */
    private setupMetrics(intervalMs?: number): void {
        if (!this.container) {
            return;
        }

        this.metricsService = new MetricsService(this.container);
        
        // Register metrics service in container
        this.container.registerInstance('MetricsService', this.metricsService);

        // Start system metrics collection
        this.metricsService.startSystemMetricsCollection(intervalMs);

        const logger = this.container.resolve<Logger>(TYPES.Logger);
        logger.info('✅ Metrics collection enabled');
    }

    /**
     * Get metrics service
     */
    getMetricsService(): MetricsService | undefined {
        return this.metricsService;
    }

    /**
     * Setup health checks
     */
    private setupHealthChecks(): void {
        if (!this.container) {
            return;
        }

        this.healthCheckService = new HealthCheckService(this.container);
        
        // Register health check service in container
        this.container.registerInstance('HealthCheckService', this.healthCheckService);

        // Add custom health checks
        this.healthCheckService.addChecker('startup', async () => ({
            name: 'startup',
            status: 'pass',
            duration: 0,
            message: 'Application started successfully'
        }));

        const logger = this.container.resolve<Logger>(TYPES.Logger);
        logger.info('✅ Health checks enabled');
    }

    /**
     * Get health check service
     */
    getHealthCheckService(): HealthCheckService | undefined {
        return this.healthCheckService;
    }

    /**
     * Setup graceful shutdown handlers
     */
    private setupGracefulShutdown(timeoutMs: number = 5000): void {
        const shutdown = async (signal: string) => {
            console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
            
            // Set a timeout to force exit if graceful shutdown takes too long
            const forceExitTimer = setTimeout(() => {
                console.error('⚠️ Graceful shutdown timeout, forcing exit...');
                process.exit(1);
            }, timeoutMs);

            try {
                await this.shutdown();
                clearTimeout(forceExitTimer);
                process.exit(0);
            } catch (error) {
                console.error('Error during graceful shutdown:', error);
                clearTimeout(forceExitTimer);
                process.exit(1);
            }
        };

        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        
        // Handle uncaught exceptions and unhandled rejections
        process.on('uncaughtException', async (error) => {
            console.error('Uncaught Exception:', error);
            await shutdown('UNCAUGHT_EXCEPTION');
        });

        process.on('unhandledRejection', async (reason) => {
            console.error('Unhandled Rejection:', reason);
            await shutdown('UNHANDLED_REJECTION');
        });
    }

    /**
     * Add custom shutdown handler
     */
    onShutdown(handler: () => Promise<void>): void {
        this.shutdownHandlers.push(handler);
    }
}

/**
 * Convenience function for quick server startup
 * Perfect for simple applications
 */
export async function startApplication<TConfig extends BaseAppConfig>(
    config: TConfig, 
    options: BootstrapOptions = {}
): Promise<{ container: Container; serviceRegistry: ServiceRegistry<TConfig> }> {
    const bootstrap = new ApplicationBootstrap(config);
    return await bootstrap.start(options);
}

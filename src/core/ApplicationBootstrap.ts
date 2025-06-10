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
}

/**
 * Application Bootstrap Class
 * Simplifies server startup to a single method call
 */
export class ApplicationBootstrap<TConfig extends BaseAppConfig = BaseAppConfig> {
    private serviceRegistry: ServiceRegistry<TConfig>;
    private container?: Container;

    constructor(config: TConfig) {
        this.serviceRegistry = new ServiceRegistry(config);
    }

    /**
     * Start the application with minimal configuration
     * Handles all the boilerplate automatically
     */
    async start(options: BootstrapOptions = {}): Promise<{ container: Container; serviceRegistry: ServiceRegistry<TConfig> }> {
        const startTime = Date.now();
        
        try {
            // 1. Setup application with auto-discovery
            console.log('🚀 Starting application with Auto-Discovery...');
            const { container } = await this.serviceRegistry.setupApplicationWithAutoDiscovery(options.discoveryPatterns);
            this.container = container;

            // 2. Initialize database if not skipped
            if (!options.skipDatabaseInit) {
                await this.initializeDatabase(options.schemaPath);
            }

            // 3. Start the server
            await this.serviceRegistry.startServer();

            // 4. Log success
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
        if (!this.container) {
            return;
        }

        try {
            const logger = this.container.resolve<Logger>(TYPES.Logger);
            logger.info('🛑 Shutting down application...');

            // Close database connections
            const dbProvider = this.container.resolve<DatabaseProvider>(TYPES.DatabaseProvider);
            await dbProvider.disconnect();

            logger.info('✅ Application shutdown completed');
        } catch (error) {
            console.error('Error during shutdown:', error);
        }
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

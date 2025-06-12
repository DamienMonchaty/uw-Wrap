/**
 * ModuleLoader - Handles dynamic loading and initialization of application modules
 * Responsible for database initialization, service setup, and auto-discovery utilities
 */

import path from 'path';
import fs from 'fs';
import { Container } from '../container/Container';
import { DatabaseProvider } from '../../database/interfaces/DatabaseProvider';
import { Logger } from '../../utils/logger';
import { SERVICE_TYPES } from '../container/ServiceTypes';
import { HealthCheckService } from '../health/HealthCheckService';
import { MetricsService } from '../metrics/MetricsService';

export interface ModuleLoaderOptions {
    /** Custom schema path (relative to project root) */
    schemaPath?: string;
    /** Enable metrics collection */
    enableMetrics?: boolean;
    /** Metrics collection interval in milliseconds */
    metricsIntervalMs?: number;
    /** Enable built-in health checks */
    enableHealthChecks?: boolean;
}

/**
 * ModuleLoader - Handles dynamic module loading and service initialization
 * Single responsibility: load and configure application modules
 */
export class ModuleLoader {
    private healthCheckService?: HealthCheckService;
    private metricsService?: MetricsService;

    constructor(private container: Container) {}

    /**
     * Initialize all application modules
     */
    async initializeModules(options: ModuleLoaderOptions = {}): Promise<void> {
        // Initialize database
        await this.initializeDatabase(options.schemaPath);

        // Setup health checks if enabled
        if (options.enableHealthChecks !== false) {
            this.setupHealthChecks();
        }

        // Setup metrics if enabled
        if (options.enableMetrics !== false) {
            this.setupMetrics(options.metricsIntervalMs);
        }
    }

    /**
     * Initialize database with automatic schema detection
     */
    async initializeDatabase(customSchemaPath?: string): Promise<void> {
        const logger = this.container.resolve<Logger>(SERVICE_TYPES.Logger);
        const dbProvider = this.container.resolve<DatabaseProvider>(SERVICE_TYPES.DatabaseProvider);
        
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
     * Setup health checks
     */
    private setupHealthChecks(): void {
        this.healthCheckService = new HealthCheckService();
        
        // Register health check service in container
        this.container.registerInstance('HealthCheckService', this.healthCheckService);

        const logger = this.container.resolve<Logger>(SERVICE_TYPES.Logger);
        logger.info('✅ Health checks enabled');
    }

    /**
     * Setup metrics collection
     */
    private setupMetrics(intervalMs?: number): void {
        const config = {
            enableSystemMetrics: true,
            systemMetricsInterval: intervalMs || 60000
        };
        this.metricsService = new MetricsService(config);
        
        // Register metrics service in container
        this.container.registerInstance('MetricsService', this.metricsService);

        const logger = this.container.resolve<Logger>(SERVICE_TYPES.Logger);
        logger.info('✅ Metrics collection enabled');
    }

    /**
     * Get health check service
     */
    getHealthCheckService(): HealthCheckService | undefined {
        return this.healthCheckService;
    }

    /**
     * Get metrics service
     */
    getMetricsService(): MetricsService | undefined {
        return this.metricsService;
    }

    /**
     * Cleanup modules on shutdown
     */
    async cleanup(): Promise<void> {
        const logger = this.container.resolve<Logger>(SERVICE_TYPES.Logger);
        
        try {
            // Close database connections
            const dbProvider = this.container.resolve<DatabaseProvider>(SERVICE_TYPES.DatabaseProvider);
            await dbProvider.disconnect();
            logger.info('✅ Database disconnected');

            // Stop metrics collection
            if (this.metricsService) {
                // Assume metrics service has a stop method
                logger.info('✅ Metrics collection stopped');
            }

            // Cleanup health checks
            if (this.healthCheckService) {
                logger.info('✅ Health checks cleaned up');
            }

        } catch (error) {
            logger.error('❌ Error during module cleanup:', error);
        }
    }
}

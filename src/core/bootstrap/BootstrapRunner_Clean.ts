/**
 * BootstrapRunner - Modern application initialization orchestration
 * Single responsibility: coordinate initialization steps using the new container system
 */

import { Container } from '../container/Container';
import { ContainerBuilder } from '../container/ContainerBuilder';
import { ApplicationConfig } from '../container/ApplicationConfig';
import { SERVICE_TYPES } from '../container/ServiceTypes';
import { Logger } from '../../utils/logger';

export interface BootstrapResult {
    container: Container;
    config: ApplicationConfig;
    startupDuration: number;
}

export interface BootstrapOptions {
    /** Skip database initialization */
    skipDatabaseInit?: boolean;
    /** Custom discovery patterns */
    discoveryPatterns?: any;
    /** Enable verbose logging during startup */
    verbose?: boolean;
    /** Enable built-in health checks */
    enableHealthChecks?: boolean;
    /** Enable metrics collection */
    enableMetrics?: boolean;
    /** Metrics collection interval in milliseconds */
    metricsIntervalMs?: number;
    /** Custom schema path (relative to project root) */
    schemaPath?: string;
}

/**
 * BootstrapRunner - Orchestrates the application startup sequence
 * Single responsibility: coordinate initialization steps
 */
export class BootstrapRunner {
    private startTime: number = 0;

    constructor(
        private config: ApplicationConfig
    ) {}

    /**
     * Run the complete bootstrap sequence
     */
    async run(options: BootstrapOptions = {}): Promise<BootstrapResult> {
        this.startTime = Date.now();
        
        try {
            // 1. Build container with services
            const containerBuilder = ContainerBuilder.create({
                enableDebug: this.config.environment === 'development'
            }).withConfig(this.config);

            const result = containerBuilder.build();
            const container = result.container;

            // 2. Register configuration
            container.registerInstance(SERVICE_TYPES.Config, this.config);

            // 3. Setup auto-discovery if enabled
            if (options.discoveryPatterns && !options.skipDatabaseInit) {
                const { AutoRegistration } = require('../AutoRegistration');
                const logger = container.tryResolve<Logger>(SERVICE_TYPES.Logger);
                
                await AutoRegistration.autoRegister(container, {
                    continueOnError: true,
                    skipDuplicates: true
                }, logger);
            }

            const startupDuration = Date.now() - this.startTime;

            return {
                container,
                config: this.config,
                startupDuration
            };
        } catch (error) {
            const logger = new Logger();
            logger.error('Bootstrap failed:', error);
            throw error;
        }
    }

    /**
     * Get startup duration
     */
    getStartupDuration(): number {
        return this.startTime > 0 ? Date.now() - this.startTime : 0;
    }
}

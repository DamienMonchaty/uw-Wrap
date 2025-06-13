/**
 * ServerStarter - Manages server lifecycle and OS signal handling
 * Responsible for graceful startup, shutdown, and process signal management
 */

import { Logger } from '../../utils/logger';

export interface ServerStarterOptions {
    /** Enable automatic graceful shutdown handling */
    enableGracefulShutdown?: boolean;
    /** Shutdown timeout in milliseconds */
    shutdownTimeoutMs?: number;
    /** Enable verbose logging */
    verbose?: boolean;
}

export type ShutdownHandler = () => Promise<void>;

/**
 * ServerStarter - Manages server lifecycle and OS signals
 * Single responsibility: server startup, shutdown, and signal handling
 */
export class ServerStarter {
    private shutdownHandlers: ShutdownHandler[] = [];
    private isShuttingDown = false;
    private logger?: Logger;

    constructor(
        logger?: Logger
    ) {
        this.logger = logger;
    }

    /**
     * Start the server with lifecycle management
     */
    async start(options: ServerStarterOptions = {}): Promise<void> {
        try {
            // Setup graceful shutdown if enabled (default: true)
            if (options.enableGracefulShutdown !== false) {
                this.setupGracefulShutdown(options.shutdownTimeoutMs);
            }

            if (options.verbose && this.logger) {
                this.logger.info('🚀 Server lifecycle management enabled');
            }

        } catch (error) {
            if (this.logger) {
                this.logger.error('❌ Failed to start server lifecycle management:', error);
            }
            throw error;
        }
    }

    /**
     * Setup graceful shutdown handlers for OS signals
     */
    private setupGracefulShutdown(timeoutMs: number = 5000): void {
        const shutdown = async (signal: string) => {
            if (this.logger) {
                this.logger.info(`🛑 Received ${signal}, shutting down gracefully...`);
            } else {
                console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
            }
            
            // Set a timeout to force exit if graceful shutdown takes too long
            const forceExitTimer = setTimeout(() => {
                const message = '⚠️ Graceful shutdown timeout, forcing exit...';
                if (this.logger) {
                    this.logger.error(message);
                } else {
                    console.error(message);
                }
                process.exit(1);
            }, timeoutMs);

            try {
                await this.shutdown();
                clearTimeout(forceExitTimer);
                process.exit(0);
            } catch (error) {
                const message = 'Error during graceful shutdown:';
                if (this.logger) {
                    this.logger.error(message, error);
                } else {
                    console.error(message, error);
                }
                clearTimeout(forceExitTimer);
                process.exit(1);
            }
        };

        // Register signal handlers
        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        
        // Handle uncaught exceptions and unhandled rejections
        process.on('uncaughtException', async (error) => {
            const message = 'Uncaught Exception:';
            if (this.logger) {
                this.logger.error(message, error);
            } else {
                console.error(message, error);
            }
            await shutdown('UNCAUGHT_EXCEPTION');
        });

        process.on('unhandledRejection', async (reason) => {
            const message = 'Unhandled Rejection:';
            if (this.logger) {
                this.logger.error(message, reason);
            } else {
                console.error(message, reason);
            }
            await shutdown('UNHANDLED_REJECTION');
        });
    }

    /**
     * Graceful shutdown sequence
     */
    async shutdown(): Promise<void> {
        if (this.isShuttingDown) {
            return;
        }

        this.isShuttingDown = true;

        try {
            if (this.logger) {
                this.logger.info('🛑 Starting shutdown sequence...');
            }

            // Execute custom shutdown handlers first
            for (const handler of this.shutdownHandlers) {
                try {
                    await handler();
                } catch (error) {
                    if (this.logger) {
                        this.logger.error('Error in shutdown handler:', error);
                    }
                }
            }

            if (this.logger) {
                this.logger.info('✅ Shutdown sequence completed');
            }

        } catch (error) {
            if (this.logger) {
                this.logger.error('❌ Error during shutdown:', error);
            } else {
                console.error('Error during shutdown:', error);
            }
        }
    }

    /**
     * Add custom shutdown handler
     */
    onShutdown(handler: ShutdownHandler): void {
        this.shutdownHandlers.push(handler);
    }

    /**
     * Remove shutdown handler
     */
    removeShutdownHandler(handler: ShutdownHandler): void {
        const index = this.shutdownHandlers.indexOf(handler);
        if (index > -1) {
            this.shutdownHandlers.splice(index, 1);
        }
    }

    /**
     * Check if server is shutting down
     */
    isServerShuttingDown(): boolean {
        return this.isShuttingDown;
    }
}

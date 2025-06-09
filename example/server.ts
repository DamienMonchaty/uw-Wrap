// ============================================================================
// SERVER BOOTSTRAP - Main application entry point with Enhanced Router
// ============================================================================

import 'dotenv/config';

// ============================================================================
// CORE INFRASTRUCTURE IMPORTS
// ============================================================================
import { Container } from '../src/core/ioc-container';
import { Logger } from '../src/utils/logger';
import { ErrorHandler } from '../src/utils/errorHandler';
import { ErrorMiddleware } from '../src/middleware/errorMiddleware';
import { DatabaseProvider } from '../src/database/interfaces/DatabaseProvider';

// ============================================================================
// APPLICATION LAYER IMPORTS
// ============================================================================
import { ServiceRegistry, createConfigFromEnv, AppConfig } from './core/ServiceRegistry';
import { TYPES } from './types/AppTypes';

// ============================================================================
// APPLICATION BOOTSTRAP
// ============================================================================

/**
 * Initialize IoC Container and Enhanced Router
 */
async function initializeApplication() {
    const config = createConfigFromEnv();
    const container = new Container();
    const serviceRegistry = new ServiceRegistry(config, container);
    
    // Setup all services and enhanced router
    const { router } = await serviceRegistry.setupApplication();
    
    return { config, container, serviceRegistry, router };
}

/**
 * Initialize database connection
 * @throws {Error} If database connection fails
 */
async function initializeDatabase(container: Container): Promise<void> {
    try {
        const dbProvider = container.resolve<DatabaseProvider>(TYPES.DatabaseProvider);
        await dbProvider.connect();
        
        const logger = container.resolve<Logger>(TYPES.Logger);
        logger.info('✅ Database connection initialized successfully');
    } catch (error) {
        const logger = container.resolve<Logger>(TYPES.Logger);
        logger.error('❌ Failed to initialize database connection:', error);
        throw error;
    }
}

// ============================================================================
// MAIN SERVER STARTUP
// ============================================================================

/**
 * Start server with Enhanced Router and decorators
 * @throws {Error} If any initialization step fails
 */
async function startServer(): Promise<void> {
    try {
        console.log('🚀 Starting server with Enhanced Router...');
        
        // Step 1: Initialize application (services, container, router)
        const { config, container, serviceRegistry } = await initializeApplication();
        const logger = container.resolve<Logger>(TYPES.Logger);
        
        logger.info('🚀 Starting server initialization...');
        
        // Step 2: Initialize database connection
        await initializeDatabase(container);
        
        // Step 3: Start the server using ServiceRegistry
        await serviceRegistry.startServer();
        
        logger.info('🎉 Server started successfully with Enhanced Router');
        
    } catch (error) {
        console.error('💥 Failed to start server:', error);
        process.exit(1);
    }
}

// ============================================================================
// APPLICATION ENTRY POINT
// ============================================================================

/**
 * Start the server if this file is run directly
 * This allows the file to be imported without auto-starting the server
 */
if (require.main === module) {
    startServer().catch((error) => {
        console.error('Fatal error during server startup:', error);
        process.exit(1);
    });
}

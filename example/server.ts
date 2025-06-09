// ============================================================================
// SERVER BOOTSTRAP - Main application entry point
// ============================================================================

import 'dotenv/config';

// ============================================================================
// CORE INFRASTRUCTURE IMPORTS
// ============================================================================
import { UWebSocketWrapper } from '../src/core/uWebSocketWrapper';
import { Container } from '../src/core/Container';
import { Logger } from '../src/utils/logger';
import { ErrorHandler } from '../src/utils/errorHandler';
import { ErrorMiddleware } from '../src/middleware/errorMiddleware';
import { JWTManager } from '../src/auth/jwtManager';
import { DatabaseProvider } from '../src/database/interfaces/DatabaseProvider';

// ============================================================================
// APPLICATION LAYER IMPORTS
// ============================================================================
import { ServiceRegistry, createConfigFromEnv, AppConfig } from './core/ServiceRegistry';
import { TYPES } from './types/AppTypes';
import { UserServiceImpl } from './services/UserService';
import { AppRepositoryManager } from './database/AppRepositoryManager';

// ============================================================================
// ROUTE HANDLERS
// ============================================================================
import { AuthHandler } from './handlers/AuthHandler';
import { UserHandler } from './handlers/UserHandler';
import { SystemHandler } from './handlers/SystemHandler';

// ============================================================================
// APPLICATION BOOTSTRAP
// ============================================================================

/**
 * Initialize IoC Container and register all services
 */
function initializeContainer() {
    const config = createConfigFromEnv();
    const container = new Container();
    const serviceRegistry = new ServiceRegistry(config, container);
    
    // Register all services in the IoC container
    serviceRegistry.registerServices();
    
    return { config, container };
}

/**
 * Resolve core services from IoC container
 */
function resolveServices(container: Container) {
    return {
        logger: container.resolve<Logger>(TYPES.Logger),
        errorHandler: container.resolve<ErrorHandler>(TYPES.ErrorHandler),
        jwtManager: container.resolve<JWTManager>(TYPES.JWTManager),
        userService: container.resolve<UserServiceImpl>(TYPES.UserService),
    };
}

// Initialize application
const { config, container } = initializeContainer();
const { logger, errorHandler, jwtManager, userService } = resolveServices(container);

// Create main server instance
const server = new UWebSocketWrapper(config.port, logger, errorHandler, jwtManager);

// Setup global error handling
const errorMiddleware = new ErrorMiddleware(errorHandler, logger);
errorMiddleware.setupGlobalErrorHandlers();

// ============================================================================
// INITIALIZATION FUNCTIONS
// ============================================================================

/**
 * Initialize database connection
 * @throws {Error} If database connection fails
 */
async function initializeDatabase(): Promise<void> {
    try {
        const dbProvider = container.resolve<DatabaseProvider>(TYPES.DatabaseProvider);
        await dbProvider.connect();
        logger.info('✅ Database connection initialized successfully');
    } catch (error) {
        logger.error('❌ Failed to initialize database connection:', error);
        throw error;
    }
}

/**
 * Initialize and register all route handlers
 */
function initializeHandlers(): void {
    logger.info('🛣️  Initializing route handlers...');
    
    // Create handler instances with dependencies
    const systemHandler = new SystemHandler(server, logger, errorHandler);
    const authHandler = new AuthHandler(server, logger, errorHandler, jwtManager);
    const userHandler = new UserHandler(server, logger, errorHandler, userService);

    // Register all routes
    systemHandler.registerRoutes();   // Health, info, WebSocket
    authHandler.registerRoutes();     // Authentication endpoints
    userHandler.registerRoutes();     // User management endpoints
    
    // Setup error monitoring routes
    errorMiddleware.setupErrorMonitoringRoutes(server);

    logger.info('✅ All handlers registered successfully');
}

// ============================================================================
// MAIN SERVER STARTUP
// ============================================================================

/**
 * Start server with all initialization steps
 * @throws {Error} If any initialization step fails
 */
async function startServer(): Promise<void> {
    try {
        logger.info('🚀 Starting server initialization...');
        
        // Step 1: Initialize database connection
        await initializeDatabase();
        
        // Step 2: Initialize all route handlers
        initializeHandlers();
        
        // Step 3: Start web server
        await server.start();
        logger.info('🎉 Server started successfully');
        
    } catch (error) {
        logger.error('💥 Failed to start server', { error });
        process.exit(1);
    }
}

// ============================================================================
// EXPORTS FOR EXTERNAL USE
// ============================================================================
export { 
    // Core infrastructure
    UWebSocketWrapper, 
    Logger, 
    ErrorHandler, 
    JWTManager, 
    AppRepositoryManager,
    
    // Route handlers
    AuthHandler,
    UserHandler,
    SystemHandler
};

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

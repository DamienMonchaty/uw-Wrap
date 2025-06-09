/**
 * Enhanced Service Registry with Modern Router Support
 * Example of how to integrate the new decorator-based routing system
 */

import { Container } from '../../src/core/ioc-container';
import { EnhancedRouter } from '../../src/core/enhanced-router';
import { UWebSocketWrapper } from '../../src/core/server-wrapper';
import { TYPES } from '../types/AppTypes';
import { Logger } from '../../src/utils/logger';
import { ErrorHandler } from '../../src/utils/errorHandler';
import { JWTManager } from '../../src/auth/jwtManager';
import { SQLiteProvider } from '../../src/database/providers/SQLiteProvider';
import { MySQLProvider } from '../../src/database/providers/MySQLProvider';
import { AppRepositoryManager } from '../database/AppRepositoryManager';
import { UserServiceImpl } from '../services/UserService';
import { DatabaseProvider } from '../../src/database/interfaces/DatabaseProvider';
import { SystemHandler } from '../handlers/SystemHandler';
import { UserHandler } from '../handlers/UserHandler';
import { AuthHandler } from '../handlers/AuthHandler';
export interface AppConfig {
    port: number;
    jwtSecret: string;
    jwtExpiresIn: string;
    database: {
        type: 'sqlite' | 'mysql';
        sqlite?: {
            file: string;
        };
        mysql?: {
            host: string;
            port: number;
            user: string;
            password: string;
            database: string;
            connectionLimit: number;
        };
    };
    cors?: {
        origin?: string | string[];
        methods?: string[];
        credentials?: boolean;
    };
    enableLogging?: boolean;
}

/**
 * Create application configuration from environment variables
 */
export function createConfigFromEnv(): AppConfig {
    return {
        port: parseInt(process.env.PORT || '3000', 10),
        jwtSecret: process.env.JWT_SECRET || 'default-secret-change-in-production',
        jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
        database: {
            type: (process.env.DB_TYPE as 'sqlite' | 'mysql') || 'sqlite',
            sqlite: {
                file: process.env.SQLITE_FILE || './database.sqlite'
            },
            mysql: process.env.DB_TYPE === 'mysql' ? {
                host: process.env.DB_HOST || 'localhost',
                port: parseInt(process.env.DB_PORT || '3306', 10),
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || '',
                database: process.env.DB_NAME || 'test',
                connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10)
            } : undefined
        },
        cors: {
            origin: process.env.CORS_ORIGIN || '*',
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
            credentials: process.env.CORS_CREDENTIALS === 'true'
        },
        enableLogging: process.env.ENABLE_LOGGING !== 'false'
    };
}

export class ServiceRegistry {
    private container: Container;
    private config: AppConfig;
    private router?: EnhancedRouter;

    constructor(config: AppConfig, container: Container = Container.getInstance()) {
        this.container = container;
        this.config = config;
    }

    /**
     * Register all services (compatibility method)
     */
    registerServices(): void {
        this.registerCoreServices();
        this.registerDatabaseServices();
        this.registerBusinessServices();
        this.registerHandlers();
    }

    /**
     * Register all services and setup routing
     */
    async setupApplication(): Promise<{ container: Container; router: EnhancedRouter }> {
        // Register all services
        this.registerCoreServices();
        this.registerDatabaseServices();
        this.registerBusinessServices();
        this.registerHandlers();

        // Setup enhanced router
        this.setupEnhancedRouter();

        // Register routes automatically
        this.registerDecoratedRoutes();

        return { 
            container: this.container, 
            router: this.router! 
        };
    }

    private registerCoreServices(): void {
        // Configuration
        this.container.registerInstance(TYPES.Config, this.config);

        // Logger (singleton)
        this.container.registerSingleton(TYPES.Logger, () => new Logger());

        // Error Handler (singleton)
        this.container.registerSingleton(TYPES.ErrorHandler, () => {
            const logger = this.container.resolve<Logger>(TYPES.Logger);
            return new ErrorHandler(logger);
        });

        // JWT Manager (singleton)
        this.container.registerSingleton(TYPES.JWTManager, () => {
            return new JWTManager(this.config.jwtSecret, this.config.jwtExpiresIn);
        });

        // uWebSocket Wrapper (singleton)
        this.container.registerSingleton('UWebSocketWrapper', () => {
            const logger = this.container.resolve<Logger>(TYPES.Logger);
            const errorHandler = this.container.resolve<ErrorHandler>(TYPES.ErrorHandler);
            const jwtManager = this.container.resolve<JWTManager>(TYPES.JWTManager);
            return new UWebSocketWrapper(this.config.port, logger, errorHandler, jwtManager);
        });
    }

    private registerDatabaseServices(): void {
        // Database Provider
        this.container.registerSingleton(TYPES.DatabaseProvider, () => {
            const config = this.config.database;
            const logger = this.container.resolve<Logger>(TYPES.Logger);
            const errorHandler = this.container.resolve<ErrorHandler>(TYPES.ErrorHandler);
            
            if (config.type === 'mysql' && config.mysql) {
                return new MySQLProvider(config.mysql, logger, errorHandler);
            } else if (config.type === 'sqlite' && config.sqlite) {
                return new SQLiteProvider(config.sqlite.file, logger, errorHandler);
            } else {
                throw new Error('Invalid database configuration');
            }
        });

        // Repository Manager
        this.container.registerSingleton('RepositoryManager', () => {
            const dbProvider = this.container.resolve<DatabaseProvider>(TYPES.DatabaseProvider);
            const logger = this.container.resolve<Logger>(TYPES.Logger);
            const errorHandler = this.container.resolve<ErrorHandler>(TYPES.ErrorHandler);
            return new AppRepositoryManager(dbProvider, logger, errorHandler);
        });
    }

    private registerBusinessServices(): void {
        // User Service
        this.container.registerSingleton(TYPES.UserService, () => {
            const repositoryManager = this.container.resolve<AppRepositoryManager>('RepositoryManager');
            const logger = this.container.resolve<Logger>(TYPES.Logger);
            return new UserServiceImpl(repositoryManager, logger);
        });
    }

    private registerHandlers(): void {
        // System Handler
        this.container.registerTransient('SystemHandler', () => {
            const wrapper = this.container.resolve<UWebSocketWrapper>('UWebSocketWrapper');
            const logger = this.container.resolve<Logger>(TYPES.Logger);
            const errorHandler = this.container.resolve<ErrorHandler>(TYPES.ErrorHandler);
            
            return new SystemHandler(wrapper, logger, errorHandler);
        });

        // Auth Handler
        this.container.registerTransient('AuthHandler', () => {
            const wrapper = this.container.resolve<UWebSocketWrapper>('UWebSocketWrapper');
            const logger = this.container.resolve<Logger>(TYPES.Logger);
            const errorHandler = this.container.resolve<ErrorHandler>(TYPES.ErrorHandler);
            const jwtManager = this.container.resolve<JWTManager>(TYPES.JWTManager);
            
            return new AuthHandler(wrapper, logger, errorHandler, jwtManager);
        });

        // User Handler
        this.container.registerTransient('UserHandler', () => {
            const wrapper = this.container.resolve<UWebSocketWrapper>('UWebSocketWrapper');
            const logger = this.container.resolve<Logger>(TYPES.Logger);
            const errorHandler = this.container.resolve<ErrorHandler>(TYPES.ErrorHandler);
            const userService = this.container.resolve<UserServiceImpl>(TYPES.UserService);
            
            return new UserHandler(wrapper, logger, errorHandler, userService);
        });
    }

    private setupEnhancedRouter(): void {
        const wrapper = this.container.resolve<UWebSocketWrapper>('UWebSocketWrapper');
        const logger = this.container.resolve<Logger>(TYPES.Logger);
        const errorHandler = this.container.resolve<ErrorHandler>(TYPES.ErrorHandler);
        const jwtManager = this.container.resolve<JWTManager>(TYPES.JWTManager);

        this.router = new EnhancedRouter(wrapper, logger, errorHandler, {
            corsOptions: this.config.cors,
            enableLogging: this.config.enableLogging !== false,
            jwtManager
        });

        this.container.registerInstance('EnhancedRouter', this.router);
    }

    private registerDecoratedRoutes(): void {
        if (!this.router) {
            throw new Error('Router must be setup before registering routes');
        }

        // Register all handlers with decorators
        const handlers = [
            {
                HandlerClass: SystemHandler,
                instance: this.container.resolve('SystemHandler')
            },
            {
                HandlerClass: AuthHandler,
                instance: this.container.resolve('AuthHandler')
            },
            {
                HandlerClass: UserHandler,
                instance: this.container.resolve('UserHandler')
            }
            // Add more handlers here as they are created
        ];

        this.router.registerHandlers(handlers);

        const logger = this.container.resolve<Logger>(TYPES.Logger);
        logger.info(`Registered ${handlers.length} decorated handler(s)`);
    }

    /**
     * Get the container
     */
    getContainer(): Container {
        return this.container;
    }

    /**
     * Get the router
     */
    getRouter(): EnhancedRouter {
        if (!this.router) {
            throw new Error('Router not initialized. Call setupApplication() first.');
        }
        return this.router;
    }

    /**
     * Start the server
     */
    async startServer(): Promise<void> {
        const wrapper = this.container.resolve<UWebSocketWrapper>('UWebSocketWrapper');
        const logger = this.container.resolve<Logger>(TYPES.Logger);
        
        try {
            await wrapper.start();
            logger.info(`🚀 Modern uW-Wrap server started on port ${this.config.port}`);
            logger.info(`📊 Enhanced routing with decorators enabled`);
            logger.info(`🔐 JWT authentication configured`);
            logger.info(`🗄️ Database: ${this.config.database.type}`);
        } catch (error) {
            logger.error('Failed to start server:', error);
            throw error;
        }
    }
}

import { Container } from '../../src/core/Container';
import { TYPES } from '../types/AppTypes';
import { Logger } from '../../src/utils/logger';
import { ErrorHandler } from '../../src/utils/errorHandler';
import { JWTManager } from '../../src/auth/jwtManager';
import { SQLiteProvider } from '../../src/database/providers/SQLiteProvider';
import { MySQLProvider } from '../../src/database/providers/MySQLProvider';
import { AppRepositoryManager } from '../database/AppRepositoryManager';
import { UserServiceImpl } from '../services/UserService';
import { DatabaseProvider } from '../../src/database/interfaces/DatabaseProvider';

/**
 * Application configuration interface
 */
export interface AppConfig {
    port: number;
    jwtSecret: string;
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
}

/**
 * Service Registry - Configures all services with IoC
 */
export class ServiceRegistry {
    private container: Container;
    private config: AppConfig;

    constructor(config: AppConfig, container: Container = Container.getInstance()) {
        this.container = container;
        this.config = config;
    }

    /**
     * Register all application services
     */
    registerServices(): Container {
        this.registerCoreServices();
        this.registerDatabaseServices();
        this.registerBusinessServices();
        
        return this.container;
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
            return new JWTManager(this.config.jwtSecret);
        });
    }

    private registerDatabaseServices(): void {
        // Database Provider (singleton)
        this.container.registerSingleton(TYPES.DatabaseProvider, () => {
            const logger = this.container.resolve<Logger>(TYPES.Logger);
            const errorHandler = this.container.resolve<ErrorHandler>(TYPES.ErrorHandler);

            if (this.config.database.type === 'mysql' && this.config.database.mysql) {
                return new MySQLProvider(this.config.database.mysql, logger, errorHandler);
            } else if (this.config.database.sqlite) {
                return new SQLiteProvider(this.config.database.sqlite.file, logger, errorHandler);
            } else {
                throw new Error('Invalid database configuration');
            }
        });

        // Repository Manager (singleton)
        this.container.registerSingleton(TYPES.AppRepositoryManager, () => {
            const provider = this.container.resolve(TYPES.DatabaseProvider);
            const logger = this.container.resolve<Logger>(TYPES.Logger);
            const errorHandler = this.container.resolve<ErrorHandler>(TYPES.ErrorHandler);
            return new AppRepositoryManager(provider as DatabaseProvider, logger, errorHandler);
        });
    }

    private registerBusinessServices(): void {
        // User Service (singleton)
        this.container.registerSingleton(TYPES.UserService, () => {
            const repositories = this.container.resolve<AppRepositoryManager>(TYPES.AppRepositoryManager);
            const logger = this.container.resolve<Logger>(TYPES.Logger);
            return new UserServiceImpl(repositories, logger);
        });
    }

    /**
     * Get configured container
     */
    getContainer(): Container {
        return this.container;
    }
}

/**
 * Create application configuration from environment
 */
export function createConfigFromEnv(): AppConfig {
    return {
        port: parseInt(process.env.PORT || '3000'),
        jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
        database: {
            type: process.env.USE_MYSQL === 'true' ? 'mysql' : 'sqlite',
            sqlite: {
                file: process.env.DB_FILE || './database.sqlite'
            },
            mysql: {
                host: process.env.DB_HOST || 'localhost',
                port: parseInt(process.env.DB_PORT || '3306'),
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || '',
                database: process.env.DB_NAME || 'uwrap_db',
                connectionLimit: 10
            }
        }
    };
}

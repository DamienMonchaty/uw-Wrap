/**
 * Framework Service Registry with Auto-Registration
 * Core framework component for automatic service discovery and registration
 */

import { Container } from './IocContainer';
import { AutoRegistration } from './AutoRegistration';
import { EnhancedRouter } from './EnhancedRouter';
import { UWebSocketWrapper } from './ServerWrapper';
import { AutoDiscovery, DiscoveryConfig } from './AutoDiscovery';
import { TYPES } from './IocContainer';
import { Logger } from '../utils/logger';
import { ErrorHandler } from '../utils/errorHandler';
import { JWTManager } from '../auth/jwtManager';
import { SQLiteProvider } from '../database/providers/SQLiteProvider';
import { MySQLProvider } from '../database/providers/MySQLProvider';
import type { DatabaseProvider } from '../database/interfaces/DatabaseProvider';
import path from 'path';

/**
 * Base Application Configuration Interface
 * Applications should extend this with their specific configuration
 */
export interface BaseAppConfig {
    port: number;
    jwtSecret: string;
    jwtExpiresIn: string;
    database: {
        type: 'sqlite' | 'mysql';
        sqlite?: { file: string; };
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
 * Default Auto-Discovery Configuration
 * Can be overridden by applications for different folder structures
 */
export interface AutoDiscoveryConfig extends DiscoveryConfig {
    // Extends DiscoveryConfig with smart defaults
}

/**
 * Default patterns for common project structures
 * Users can override these patterns based on their project layout
 */
export const DEFAULT_DISCOVERY_PATTERNS = {
    // Common patterns for handlers/controllers
    handlers: [
        'handlers/*.ts', 'handlers/**/*.ts',           // /handlers folder
        'controllers/*.ts', 'controllers/**/*.ts',     // /controllers folder
        'routes/*.ts', 'routes/**/*.ts',               // /routes folder
        '*Handler.ts', '**/*Handler.ts',               // Any file ending with Handler
        '*Controller.ts', '**/*Controller.ts',         // Any file ending with Controller
    ],
    
    // Common patterns for services
    services: [
        'services/*.ts', 'services/**/*.ts',           // /services folder
        'business/*.ts', 'business/**/*.ts',           // /business folder
        'logic/*.ts', 'logic/**/*.ts',                 // /logic folder
        '*Service.ts', '**/*Service.ts',               // Any file ending with Service
    ],
    
    // Common patterns for repositories
    repositories: [
        'repositories/*.ts', 'repositories/**/*.ts',           // /repositories folder
        'database/repositories/*.ts', 'database/repositories/**/*.ts', // /database/repositories
        'data/*.ts', 'data/**/*.ts',                           // /data folder
        'dao/*.ts', 'dao/**/*.ts',                             // /dao folder (Data Access Objects)
        '*Repository.ts', '**/*Repository.ts',                 // Any file ending with Repository
        '*RepositoryManager.ts', '**/*RepositoryManager.ts',   // Repository managers
    ],
    
    // Common patterns for middleware
    middleware: [
        'middleware/*.ts', 'middleware/**/*.ts',       // /middleware folder
        'middlewares/*.ts', 'middlewares/**/*.ts',     // /middlewares folder
        '*Middleware.ts', '**/*Middleware.ts',         // Any file ending with Middleware
    ]
};

/**
 * Framework Service Registry with Auto-Registration
 * Reduces boilerplate by 80% using decorators and auto-discovery
 */
export class ServiceRegistry<TConfig extends BaseAppConfig = BaseAppConfig> {
    private container: Container;
    private config: TConfig;
    private router?: EnhancedRouter;

    constructor(config: TConfig, container: Container = Container.getInstance()) {
        this.container = container;
        this.config = config;
    }

    /**
     * Setup application with minimal configuration
     */
    async setupApplication(): Promise<{ container: Container; router: EnhancedRouter }> {
        // 1. Register core services (manual - these are framework level)
        this.registerCoreServices();
        
        // 2. Auto-register all decorated services/handlers/repositories
        const stats = AutoRegistration.autoRegister(this.container);
        
        // 3. Setup router
        this.setupEnhancedRouter();
        
        // 4. Register routes automatically
        this.registerDecoratedRoutes();

        const logger = this.container.resolve<Logger>(TYPES.Logger);
        logger.info(`🎯 Auto-registration completed:`, stats);

        return { container: this.container, router: this.router! };
    }

    /**
     * Setup application with auto-discovery
     * Alternative to setupApplication() that scans filesystem for services
     * Uses smart defaults that work with most project structures
     */
    async setupApplicationWithAutoDiscovery(discoveryConfig: Partial<DiscoveryConfig> = {}): Promise<{ container: Container; router: EnhancedRouter }> {
        // 1. Register core services first (needed for logging during discovery)
        this.registerCoreServices();
        
        // 2. Merge user config with smart defaults
        const finalConfig: DiscoveryConfig = this.mergeDiscoveryConfig(discoveryConfig);
        
        // 3. Auto-discover and import files to trigger decorators
        await this.autoDiscover(finalConfig);
        
        // 3. Auto-register all decorated services/handlers/repositories
        const stats = AutoRegistration.autoRegister(this.container);
        
        // 4. Setup router
        this.setupEnhancedRouter();
        
        // 5. Register routes automatically
        this.registerDecoratedRoutes();

        const logger = this.container.resolve<Logger>(TYPES.Logger);
        logger.info(`🎯 Auto-registration with discovery completed:`, stats);

        return { container: this.container, router: this.router! };
    }

    /**
     * Register only core framework services manually
     * Everything else should use auto-registration
     */
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

        // Database Provider (conditional)
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

        // Get all registered services from container that are controllers
        const registeredServices = this.container.getRegisteredServices();
        const handlers: any[] = [];

        console.log(`🔍 Checking ${registeredServices.length} registered services for handlers...`);

        for (const serviceId of registeredServices) {
            try {
                // Convert serviceId to string for logging (handle symbols, strings, constructors)
                const serviceIdString = typeof serviceId === 'symbol' 
                    ? serviceId.toString() 
                    : typeof serviceId === 'function' 
                        ? serviceId.name 
                        : String(serviceId);

                console.log(`🔎 Checking service: ${serviceIdString} (type: ${typeof serviceId})`);

                const instance = this.container.resolve(serviceId);
                
                console.log(`🔎 Resolved instance: ${instance?.constructor?.name}, has registerRoutes: ${typeof instance?.registerRoutes === 'function'}`);
                
                // Check if it's a handler (has registerRoutes method and extends BaseHandler)
                if (instance && 
                    typeof instance.registerRoutes === 'function' && 
                    instance.constructor.name.includes('Handler')) {
                    
                    handlers.push({
                        HandlerClass: instance.constructor,
                        instance: instance
                    });
                    
                    console.log(`✅ Found handler: ${serviceIdString} (${instance.constructor.name})`);
                }
            } catch (error) {
                // Skip services that can't be resolved or aren't handlers
                const serviceIdString = typeof serviceId === 'symbol' 
                    ? serviceId.toString() 
                    : typeof serviceId === 'function' 
                        ? serviceId.name 
                        : String(serviceId);
                console.log(`⚠️ Failed to resolve service ${serviceIdString}:`, (error as Error).message);
                continue;
            }
        }

        if (handlers.length > 0) {
            this.router.registerHandlers(handlers);
            
            const logger = this.container.resolve<Logger>(TYPES.Logger);
            logger.info(`Auto-registered ${handlers.length} handler(s) with routes`);
        } else {
            console.warn('⚠️ No handlers found for route registration');
        }
    }

    /**
     * Merge user discovery config with smart defaults
     * Users can override specific patterns while keeping defaults for others
     */
    private mergeDiscoveryConfig(userConfig: Partial<DiscoveryConfig>): DiscoveryConfig {
        const defaultConfig: DiscoveryConfig = {
            baseDir: userConfig.baseDir || process.cwd(), // Default to current working directory
            patterns: DEFAULT_DISCOVERY_PATTERNS,
            excludePatterns: [
                '**/node_modules/**',
                '**/dist/**',
                '**/build/**',
                '**/*.d.ts',
                '**/*.test.ts',
                '**/*.spec.ts',
                '**/tests/**',
                '**/test/**'
            ]
        };

        return {
            ...defaultConfig,
            ...userConfig,
            patterns: {
                ...defaultConfig.patterns,
                ...userConfig.patterns
            },
            excludePatterns: userConfig.excludePatterns || defaultConfig.excludePatterns
        };
    }

    /**
     * Auto-discover services using the AutoDiscovery service
     * This replaces manual imports by scanning the filesystem
     */
    private async autoDiscover(config: DiscoveryConfig): Promise<void> {
        const logger = this.container.resolve<Logger>(TYPES.Logger);
        const autoDiscovery = new AutoDiscovery(logger);
        await autoDiscovery.discoverAndImport(config);
    }

    getContainer(): Container {
        return this.container;
    }

    getRouter(): EnhancedRouter {
        if (!this.router) {
            throw new Error('Router not initialized. Call setupApplication() first.');
        }
        return this.router;
    }

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

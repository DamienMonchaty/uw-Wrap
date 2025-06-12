/**
 * Application Configuration Interface
 * Extends the base framework configuration with app-specific settings
 */

import { ApplicationConfig } from '../../src/core/container/ApplicationConfig';

export interface AppConfig extends ApplicationConfig {
    // Add any application-specific configuration here
    // For example:
    // apiKeys?: {
    //     stripe?: string;
    //     sendgrid?: string;
    // };
}

/**
 * Create configuration from environment variables
 * Standard factory function for uW-Wrap applications
 */
export function createConfigFromEnv(): AppConfig {
    return {
        server: {
            port: parseInt(process.env.PORT || '3000', 10),
            host: process.env.HOST || '0.0.0.0'
        },
        auth: {
            jwtSecret: process.env.JWT_SECRET || 'default-secret-change-in-production',
            jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h'
        },
        database: {
            type: (process.env.DB_TYPE as 'sqlite' | 'mysql') || 'sqlite',
            sqlite: { file: process.env.SQLITE_FILE || './database.sqlite' },
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
        logging: {
            enabled: process.env.ENABLE_LOGGING !== 'false',
            level: (process.env.LOG_LEVEL as any) || 'info'
        },
        environment: (process.env.NODE_ENV as any) || 'development'
    };
}

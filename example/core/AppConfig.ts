/**
 * Application Confi            host: process.env.HOST || '0.0.0.0'
        },
        auth: {
            jwtSecret: process.env.JWT_SECRET || 'default-secret-change-in-production',
            jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h'
        },
        cors: { * Extends the base framework configuration with app-specific settings
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

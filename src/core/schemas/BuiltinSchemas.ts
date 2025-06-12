/**
 * Default Configuration Schemas
 * Built-in validation schemas for common application configurations
 */

import { ValidationSchema } from '../interfaces/IValidationProvider';

/**
 * Base application configuration schema
 */
export const BaseAppConfigSchema: ValidationSchema = {
    fields: {
        'server.port': [
            { type: 'number', defaultValue: 3000 },
            { type: 'min', value: 1, message: 'Port must be at least 1' },
            { type: 'max', value: 65535, message: 'Port must be at most 65535' }
        ],
        'server.host': [
            { type: 'string', defaultValue: '127.0.0.1' }
        ],
        'server.environment': [
            { type: 'string', defaultValue: 'development' },
            { type: 'enum', value: ['development', 'production', 'test'], message: 'Environment must be development, production, or test' }
        ],
        'database.provider': [
            { type: 'string', defaultValue: 'sqlite' },
            { type: 'enum', value: ['sqlite', 'mysql', 'postgresql'], message: 'Database provider must be sqlite, mysql, or postgresql' }
        ],
        'database.filename': [
            { type: 'string', defaultValue: './database.sqlite' }
        ],
        'database.host': [
            { type: 'optional' },
            { type: 'string' }
        ],
        'database.port': [
            { type: 'optional' },
            { type: 'number' },
            { type: 'min', value: 1 },
            { type: 'max', value: 65535 }
        ],
        'database.username': [
            { type: 'optional' },
            { type: 'string' }
        ],
        'database.password': [
            { type: 'optional' },
            { type: 'string' }
        ],
        'database.database': [
            { type: 'optional' },
            { type: 'string' }
        ],
        'auth.jwtSecret': [
            { type: 'string' },
            { type: 'min', value: 32, message: 'JWT secret must be at least 32 characters' }
        ],
        'auth.jwtExpiresIn': [
            { type: 'string', defaultValue: '24h' }
        ],
        'logging.level': [
            { type: 'string', defaultValue: 'info' },
            { type: 'enum', value: ['error', 'warn', 'info', 'debug'], message: 'Log level must be error, warn, info, or debug' }
        ],
        'logging.file': [
            { type: 'optional' },
            { type: 'string' }
        ]
    },
    validators: [
        // Custom validator to ensure database config is complete when not using sqlite
        (data, context) => {
            if (data.database?.provider !== 'sqlite') {
                const required = ['host', 'port', 'username', 'database'];
                const missing = required.filter(field => !data.database?.[field]);
                if (missing.length > 0) {
                    return `Database configuration incomplete for ${data.database?.provider}. Missing: ${missing.join(', ')}`;
                }
            }
            return true;
        }
    ]
};

/**
 * JWT Configuration schema
 */
export const JwtConfigSchema: ValidationSchema = {
    fields: {
        'secret': [
            { type: 'required' },
            { type: 'string' },
            { type: 'min', value: 32, message: 'JWT secret must be at least 32 characters' }
        ],
        'expiresIn': [
            { type: 'string', defaultValue: '24h' },
            { type: 'pattern', value: /^\d+[smhdw]$/, message: 'expiresIn must be in format like 1h, 30m, 7d' }
        ],
        'issuer': [
            { type: 'optional' },
            { type: 'string' }
        ],
        'audience': [
            { type: 'optional' },
            { type: 'string' }
        ]
    }
};

/**
 * Database Configuration schema
 */
export const DatabaseConfigSchema: ValidationSchema = {
    fields: {
        'provider': [
            { type: 'required' },
            { type: 'string' },
            { type: 'enum', value: ['sqlite', 'mysql', 'postgresql'] }
        ],
        'filename': [
            { type: 'optional' },
            { type: 'string' }
        ],
        'host': [
            { type: 'optional' },
            { type: 'string' }
        ],
        'port': [
            { type: 'optional' },
            { type: 'number' },
            { type: 'min', value: 1 },
            { type: 'max', value: 65535 }
        ],
        'username': [
            { type: 'optional' },
            { type: 'string' }
        ],
        'password': [
            { type: 'optional' },
            { type: 'string' }
        ],
        'database': [
            { type: 'optional' },
            { type: 'string' }
        ],
        'ssl': [
            { type: 'optional' },
            { type: 'boolean' }
        ],
        'connectionTimeout': [
            { type: 'optional' },
            { type: 'number' },
            { type: 'min', value: 1000, message: 'Connection timeout must be at least 1000ms' }
        ],
        'maxConnections': [
            { type: 'optional' },
            { type: 'number' },
            { type: 'min', value: 1 },
            { type: 'max', value: 100 }
        ]
    },
    validators: [
        (data) => {
            // Validate required fields based on provider
            if (data.provider === 'sqlite') {
                if (!data.filename) {
                    return 'SQLite provider requires filename';
                }
            } else {
                const required = ['host', 'port', 'username', 'database'];
                const missing = required.filter(field => !data[field]);
                if (missing.length > 0) {
                    return `${data.provider} provider requires: ${missing.join(', ')}`;
                }
            }
            return true;
        }
    ]
};

/**
 * Server Configuration schema
 */
export const ServerConfigSchema: ValidationSchema = {
    fields: {
        'port': [
            { type: 'required' },
            { type: 'number' },
            { type: 'min', value: 1 },
            { type: 'max', value: 65535 }
        ],
        'host': [
            { type: 'string', defaultValue: '127.0.0.1' }
        ],
        'environment': [
            { type: 'string', defaultValue: 'development' },
            { type: 'enum', value: ['development', 'production', 'test'] }
        ],
        'cors': [
            { type: 'optional' },
            { type: 'object' }
        ],
        'rateLimit': [
            { type: 'optional' },
            { type: 'object' }
        ],
        'compression': [
            { type: 'boolean', defaultValue: true }
        ],
        'security': [
            { type: 'optional' },
            { type: 'object' }
        ]
    }
};

/**
 * Logging Configuration schema
 */
export const LoggingConfigSchema: ValidationSchema = {
    fields: {
        'level': [
            { type: 'string', defaultValue: 'info' },
            { type: 'enum', value: ['error', 'warn', 'info', 'debug', 'trace'] }
        ],
        'file': [
            { type: 'optional' },
            { type: 'string' }
        ],
        'maxFileSize': [
            { type: 'optional' },
            { type: 'string' },
            { type: 'pattern', value: /^\d+[kmg]b$/i, message: 'maxFileSize must be in format like 10mb, 1gb' }
        ],
        'maxFiles': [
            { type: 'optional' },
            { type: 'number' },
            { type: 'min', value: 1 }
        ],
        'console': [
            { type: 'boolean', defaultValue: true }
        ],
        'json': [
            { type: 'boolean', defaultValue: false }
        ]
    }
};

/**
 * Cache Configuration schema
 */
export const CacheConfigSchema: ValidationSchema = {
    fields: {
        'provider': [
            { type: 'string', defaultValue: 'memory' },
            { type: 'enum', value: ['memory', 'redis'] }
        ],
        'ttl': [
            { type: 'optional' },
            { type: 'number' },
            { type: 'min', value: 1000, message: 'TTL must be at least 1000ms' }
        ],
        'maxSize': [
            { type: 'optional' },
            { type: 'number' },
            { type: 'min', value: 1 }
        ],
        'redis': [
            { type: 'optional' },
            { type: 'object' }
        ]
    }
};

/**
 * Metrics Configuration schema
 */
export const MetricsConfigSchema: ValidationSchema = {
    fields: {
        'enabled': [
            { type: 'boolean', defaultValue: true }
        ],
        'provider': [
            { type: 'string', defaultValue: 'memory' },
            { type: 'enum', value: ['memory', 'prometheus', 'statsd'] }
        ],
        'interval': [
            { type: 'optional' },
            { type: 'number' },
            { type: 'min', value: 1000, message: 'Metrics interval must be at least 1000ms' }
        ],
        'endpoint': [
            { type: 'optional' },
            { type: 'string' }
        ]
    }
};

/**
 * All built-in schemas registry
 */
export const BuiltinSchemas = {
    BaseAppConfig: BaseAppConfigSchema,
    JwtConfig: JwtConfigSchema,
    DatabaseConfig: DatabaseConfigSchema,
    ServerConfig: ServerConfigSchema,
    LoggingConfig: LoggingConfigSchema,
    CacheConfig: CacheConfigSchema,
    MetricsConfig: MetricsConfigSchema
} as const;

/**
 * Schema names type for type safety
 */
export type BuiltinSchemaName = keyof typeof BuiltinSchemas;

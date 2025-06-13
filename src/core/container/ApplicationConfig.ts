/**
 * Application Configuration - Modern replacement for BaseAppConfig
 * Single Responsibility: Define application configuration structure and validation
 */

import { ValidationSchema, ValidationRule } from '../interfaces/IValidationProvider';
import { NativeValidationProvider } from '../validation/NativeValidationProvider';

// ============================================================================
// CONFIGURATION INTERFACES
// ============================================================================

/**
 * Modern application configuration interface
 * Replaces the deprecated BaseAppConfig with better structure and validation
 */
export interface ApplicationConfig {
    /** Server configuration */
    server: ServerConfig;
    /** Authentication configuration */
    auth: AuthConfig;
    /** CORS configuration */
    cors?: CorsConfig;
    /** Logging configuration */
    logging?: LoggingConfig;
    /** Environment */
    environment?: 'development' | 'production' | 'test';
    /** Application metadata */
    metadata?: ApplicationMetadata;
}

export interface ServerConfig {
    /** Server port */
    port: number;
    /** Server host */
    host?: string;
    /** Timeout settings */
    timeout?: {
        request?: number;
        idle?: number;
    };
    /** SSL configuration */
    ssl?: {
        enabled: boolean;
        certPath?: string;
        keyPath?: string;
    };
}

export interface AuthConfig {
    /** JWT secret key */
    jwtSecret: string;
    /** JWT expiration time */
    jwtExpiresIn: string;
    /** JWT issuer */
    jwtIssuer?: string;
    /** JWT audience */
    jwtAudience?: string;
    /** Refresh token configuration */
    refreshToken?: {
        enabled: boolean;
        expiresIn: string;
    };
}

export interface CorsConfig {
    /** Allowed origins */
    origin?: string | string[] | boolean;
    /** Allowed methods */
    methods?: string[];
    /** Allow credentials */
    credentials?: boolean;
    /** Allowed headers */
    allowedHeaders?: string[];
    /** Exposed headers */
    exposedHeaders?: string[];
    /** Max age */
    maxAge?: number;
}

export interface LoggingConfig {
    /** Enable logging */
    enabled: boolean;
    /** Log level */
    level?: 'debug' | 'info' | 'warn' | 'error';
    /** Log format */
    format?: 'json' | 'text';
    /** Log output */
    output?: 'console' | 'file' | 'both';
    /** Log file path */
    filePath?: string;
}

export interface ApplicationMetadata {
    /** Application name */
    name?: string;
    /** Application version */
    version?: string;
    /** Application description */
    description?: string;
    /** Build timestamp */
    buildTime?: string;
    /** Git commit hash */
    gitHash?: string;
}

// ============================================================================
// NATIVE VALIDATION SCHEMAS
// ============================================================================

/**
 * Validation rules helpers for the native validation system
 */
const createValidationRules = {
    required: (message = 'Field is required'): ValidationRule => ({
        type: 'required',
        message
    }),

    string: (message = 'Must be a string'): ValidationRule => ({
        type: 'string',
        message
    }),

    number: (message = 'Must be a number'): ValidationRule => ({
        type: 'number',
        message
    }),

    integer: (message = 'Must be an integer'): ValidationRule => ({
        type: 'number',
        message,
        validator: (value: any) => Number.isInteger(value) || 'Must be an integer'
    }),

    boolean: (message = 'Must be a boolean'): ValidationRule => ({
        type: 'boolean',
        message
    }),

    min: (min: number, message?: string): ValidationRule => ({
        type: 'min',
        value: min,
        message: message || `Must be at least ${min}`
    }),

    max: (max: number, message?: string): ValidationRule => ({
        type: 'max',
        value: max,
        message: message || `Must be at most ${max}`
    }),

    minLength: (min: number, message?: string): ValidationRule => ({
        type: 'custom',
        message: message || `Must be at least ${min} characters`,
        validator: (value: any) => typeof value === 'string' && value.length >= min
    }),

    enum: <T>(values: T[], message?: string): ValidationRule => ({
        type: 'enum',
        value: values,
        message: message || `Must be one of: ${values.join(', ')}`
    }),

    port: (message = 'Must be a valid port number (1-65535)'): ValidationRule => ({
        type: 'custom',
        message,
        validator: (value: any) => typeof value === 'number' && value >= 1 && value <= 65535
    })
};

/**
 * Server configuration validation schema
 */
export const ServerConfigSchema: ValidationSchema = {
    fields: {
        port: [
            createValidationRules.required(),
            createValidationRules.number(),
            createValidationRules.port()
        ],
        host: [
            createValidationRules.string()
        ],
        'timeout.request': [
            createValidationRules.number(),
            createValidationRules.min(1)
        ],
        'timeout.idle': [
            createValidationRules.number(),
            createValidationRules.min(1)
        ],
        'ssl.enabled': [
            createValidationRules.boolean()
        ],
        'ssl.certPath': [
            createValidationRules.string()
        ],
        'ssl.keyPath': [
            createValidationRules.string()
        ]
    }
};

/**
 * Authentication configuration validation schema
 */
export const AuthConfigSchema: ValidationSchema = {
    fields: {
        jwtSecret: [
            createValidationRules.required(),
            createValidationRules.string(),
            createValidationRules.minLength(32, 'JWT secret must be at least 32 characters')
        ],
        jwtExpiresIn: [
            createValidationRules.required(),
            createValidationRules.string()
        ],
        jwtIssuer: [
            createValidationRules.string()
        ],
        jwtAudience: [
            createValidationRules.string()
        ],
        'refreshToken.enabled': [
            createValidationRules.boolean()
        ],
        'refreshToken.expiresIn': [
            createValidationRules.string()
        ]
    }
};

/**
 * Database configuration validation schema
 */
export const DatabaseConfigSchema: ValidationSchema = {
    fields: {
        type: [
            createValidationRules.required(),
            createValidationRules.enum(['sqlite', 'mysql', 'postgresql'])
        ],
        'sqlite.file': [
            createValidationRules.string()
        ],
        'sqlite.walMode': [
            createValidationRules.boolean()
        ],
        'mysql.host': [
            createValidationRules.string()
        ],
        'mysql.port': [
            createValidationRules.number(),
            createValidationRules.port()
        ],
        'mysql.user': [
            createValidationRules.string()
        ],
        'mysql.password': [
            createValidationRules.string()
        ],
        'mysql.database': [
            createValidationRules.string()
        ],
        'mysql.connectionLimit': [
            createValidationRules.number(),
            createValidationRules.min(1)
        ],
        'postgresql.host': [
            createValidationRules.string()
        ],
        'postgresql.port': [
            createValidationRules.number(),
            createValidationRules.port()
        ],
        'postgresql.user': [
            createValidationRules.string()
        ],
        'postgresql.password': [
            createValidationRules.string()
        ],
        'postgresql.database': [
            createValidationRules.string()
        ]
    }
};

/**
 * CORS configuration validation schema
 */
export const CorsConfigSchema: ValidationSchema = {
    fields: {
        origin: [
            {
                type: 'custom',
                message: 'Origin must be a string, boolean, or array of strings',
                validator: (value: any) =>
                    typeof value === 'string' ||
                    typeof value === 'boolean' ||
                    (Array.isArray(value) && value.every(v => typeof v === 'string'))
            }
        ],
        methods: [
            {
                type: 'custom',
                message: 'Methods must be an array of strings',
                validator: (value: any) => Array.isArray(value) && value.every(v => typeof v === 'string')
            }
        ],
        credentials: [
            createValidationRules.boolean()
        ],
        maxAge: [
            createValidationRules.number(),
            createValidationRules.min(0)
        ]
    }
};

/**
 * Logging configuration validation schema
 */
export const LoggingConfigSchema: ValidationSchema = {
    fields: {
        enabled: [
            createValidationRules.boolean()
        ],
        level: [
            createValidationRules.enum(['debug', 'info', 'warn', 'error'])
        ],
        format: [
            createValidationRules.enum(['json', 'text'])
        ],
        output: [
            createValidationRules.enum(['console', 'file', 'both'])
        ],
        filePath: [
            createValidationRules.string()
        ]
    }
};

/**
 * Complete application configuration schema
 */
export const ApplicationConfigSchema: ValidationSchema = {
    fields: {
        // Server config
        ...Object.fromEntries(
            Object.entries(ServerConfigSchema.fields ?? ServerConfigSchema).map(([key, value]) => [`server.${key}`, value])
        ),
        // Auth config
        ...Object.fromEntries(
            Object.entries(AuthConfigSchema.fields ?? AuthConfigSchema).map(([key, value]) => [`auth.${key}`, value])
        ),
        // Database config
        ...Object.fromEntries(
            Object.entries(DatabaseConfigSchema.fields ?? DatabaseConfigSchema).map(([key, value]) => [`database.${key}`, value])
        ),
        // CORS config (optional)
        ...Object.fromEntries(
            Object.entries(CorsConfigSchema.fields ?? CorsConfigSchema).map(([key, value]) => [`cors.${key}`, value])
        ),
        // Logging config (optional)
        ...Object.fromEntries(
            Object.entries(LoggingConfigSchema.fields ?? LoggingConfigSchema).map(([key, value]) => [`logging.${key}`, value])
        ),
        // Environment
        environment: [
            createValidationRules.enum(['development', 'production', 'test'])
        ],
        // Metadata (all optional)
        'metadata.name': [
            createValidationRules.string()
        ],
        'metadata.version': [
            createValidationRules.string()
        ],
        'metadata.description': [
            createValidationRules.string()
        ]
    }
};

// ============================================================================
// CONFIGURATION BUILDER
// ============================================================================

/**
 * Configuration builder for creating validated application configurations
 */
export class ApplicationConfigBuilder {
    private config: Partial<ApplicationConfig> = {};
    private validator = new NativeValidationProvider();

    constructor() {
        // Register schemas
        this.validator.registerSchema('ApplicationConfig', ApplicationConfigSchema);
        this.validator.registerSchema('ServerConfig', ServerConfigSchema);
        this.validator.registerSchema('AuthConfig', AuthConfigSchema);
        this.validator.registerSchema('DatabaseConfig', DatabaseConfigSchema);
        this.validator.registerSchema('CorsConfig', CorsConfigSchema);
        this.validator.registerSchema('LoggingConfig', LoggingConfigSchema);
    }

    /**
     * Set server configuration
     */
    server(config: ServerConfig): this {
        this.config.server = config;
        return this;
    }

    /**
     * Set authentication configuration
     */
    auth(config: AuthConfig): this {
        this.config.auth = config;
        return this;
    }

    /**
     * Set CORS configuration
     */
    cors(config: CorsConfig): this {
        this.config.cors = config;
        return this;
    }

    /**
     * Set logging configuration
     */
    logging(config: LoggingConfig): this {
        this.config.logging = config;
        return this;
    }

    /**
     * Set environment
     */
    environment(env: 'development' | 'production' | 'test'): this {
        this.config.environment = env;
        return this;
    }

    /**
     * Set application metadata
     */
    metadata(metadata: ApplicationMetadata): this {
        this.config.metadata = metadata;
        return this;
    }

    /**
     * Build and validate configuration
     */
    async build(): Promise<ApplicationConfig> {
        const result = await this.validator.validate(this.config, 'ApplicationConfig');
        
        if (!result.valid) {
            const errors = result.errors.map(error => 
                `${error.field}: ${error.message}`
            ).join('\n');
            throw new Error(`Configuration validation failed:\n${errors}`);
        }
        
        return result.data as ApplicationConfig;
    }

    /**
     * Create configuration from environment variables
     */
    static fromEnvironment(): ApplicationConfigBuilder {
        const builder = new ApplicationConfigBuilder();
        
        // Server configuration
        builder.server({
            port: parseInt(process.env.PORT || '3000', 10),
            host: process.env.HOST || '0.0.0.0',
            timeout: {
                request: process.env.REQUEST_TIMEOUT ? parseInt(process.env.REQUEST_TIMEOUT, 10) : undefined,
                idle: process.env.IDLE_TIMEOUT ? parseInt(process.env.IDLE_TIMEOUT, 10) : undefined
            }
        });

        // Authentication configuration
        builder.auth({
            jwtSecret: process.env.JWT_SECRET || (() => {
                throw new Error('JWT_SECRET environment variable is required');
            })(),
            jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
            jwtIssuer: process.env.JWT_ISSUER,
            jwtAudience: process.env.JWT_AUDIENCE
        });

        // CORS configuration
        if (process.env.CORS_ORIGIN) {
            builder.cors({
                origin: process.env.CORS_ORIGIN.includes(',') ? 
                    process.env.CORS_ORIGIN.split(',').map(o => o.trim()) : 
                    process.env.CORS_ORIGIN,
                methods: process.env.CORS_METHODS ? 
                    process.env.CORS_METHODS.split(',').map(m => m.trim()) : 
                    ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
                credentials: process.env.CORS_CREDENTIALS === 'true'
            });
        }

        // Logging configuration
        builder.logging({
            enabled: process.env.ENABLE_LOGGING !== 'false',
            level: (process.env.LOG_LEVEL as any) || 'info',
            format: (process.env.LOG_FORMAT as any) || 'text',
            output: (process.env.LOG_OUTPUT as any) || 'console',
            filePath: process.env.LOG_FILE
        });

        // Environment
        builder.environment((process.env.NODE_ENV as any) || 'development');

        // Metadata
        builder.metadata({
            name: process.env.APP_NAME,
            version: process.env.APP_VERSION,
            description: process.env.APP_DESCRIPTION,
            buildTime: process.env.BUILD_TIME,
            gitHash: process.env.GIT_HASH
        });

        return builder;
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create application configuration from environment variables
 */
export async function createApplicationConfig(): Promise<ApplicationConfig> {
    return await ApplicationConfigBuilder.fromEnvironment().build();
}

/**
 * Create application configuration with defaults
 */
export function createDefaultApplicationConfig(overrides: Partial<ApplicationConfig> = {}): ApplicationConfig {
    const defaults: ApplicationConfig = {
        server: {
            port: 3000,
            host: '0.0.0.0'
        },
        auth: {
            jwtSecret: 'change-this-secret-in-production',
            jwtExpiresIn: '24h'
        },
        logging: {
            enabled: true,
            level: 'info'
        },
        environment: 'development'
    };

    return { ...defaults, ...overrides };
}

/**
 * Validate application configuration
 */
export async function validateApplicationConfig(config: unknown): Promise<ApplicationConfig> {
    const validator = new NativeValidationProvider();
    validator.registerSchema('ApplicationConfig', ApplicationConfigSchema);
    
    const result = await validator.validate(config, 'ApplicationConfig');
    
    if (!result.valid) {
        const errors = result.errors.map(error => 
            `${error.field}: ${error.message}`
        ).join('\n');
        throw new Error(`Configuration validation failed:\n${errors}`);
    }
    
    return result.data as ApplicationConfig;
}



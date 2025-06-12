/**
 * Service Types and Identifiers
 * Centralized service identification system with type safety
 */

// ============================================================================
// SERVICE IDENTIFIERS (Type-safe symbols)
// ============================================================================

export const SERVICE_TYPES = {
    // Core Framework Services
    Logger: Symbol.for('Logger'),
    ErrorHandler: Symbol.for('ErrorHandler'),
    Container: Symbol.for('Container'),
    
    // Authentication & Security
    JWTManager: Symbol.for('JWTManager'),
    JWTService: Symbol.for('JWTService'),
    AuthenticationService: Symbol.for('AuthenticationService'),
    UserRoleService: Symbol.for('UserRoleService'),
    
    // Database
    DatabaseProvider: Symbol.for('DatabaseProvider'),
    DatabaseConnection: Symbol.for('DatabaseConnection'),
    DatabaseMigrator: Symbol.for('DatabaseMigrator'),
    
    // Server & Networking
    ServerWrapper: Symbol.for('ServerWrapper'),
    Router: Symbol.for('Router'),
    MiddlewareManager: Symbol.for('MiddlewareManager'),
    RouteRegistry: Symbol.for('RouteRegistry'),
    
    // HTTP Components
    HttpHandlerWrapper: Symbol.for('HttpHandlerWrapper'),
    ResponseManager: Symbol.for('ResponseManager'),
    RequestManager: Symbol.for('RequestManager'),
    AuthenticationWrapper: Symbol.for('AuthenticationWrapper'),
    
    // Configuration
    Config: Symbol.for('Config'),
    ConfigValidator: Symbol.for('ConfigValidator'),
    EnvironmentConfig: Symbol.for('EnvironmentConfig'),
    
    // Health & Monitoring
    HealthCheckService: Symbol.for('HealthCheckService'),
    MetricsService: Symbol.for('MetricsService'),
    
    // Cache
    CacheManager: Symbol.for('CacheManager'),
    CacheProvider: Symbol.for('CacheProvider'),
    
    // Validation
    ValidationService: Symbol.for('ValidationService'),
    SchemaValidator: Symbol.for('SchemaValidator'),
    
    // File System
    FileSystem: Symbol.for('FileSystem'),
    FileDiscovery: Symbol.for('FileDiscovery'),
    
    // Event System
    EventManager: Symbol.for('EventManager'),
    EventBus: Symbol.for('EventBus'),
    
    // Auto-Registration
    AutoRegistration: Symbol.for('AutoRegistration'),
    AutoDiscovery: Symbol.for('AutoDiscovery'),
    ServiceScanner: Symbol.for('ServiceScanner'),
    
} as const;

// ============================================================================
// SERVICE TAGS
// ============================================================================

export const SERVICE_TAGS = {
    // Lifecycle
    CORE: 'core',
    INFRASTRUCTURE: 'infrastructure',
    BUSINESS: 'business',
    PRESENTATION: 'presentation',
    
    // Categories
    REPOSITORY: 'repository',
    SERVICE: 'service',
    HANDLER: 'handler',
    CONTROLLER: 'controller',
    MIDDLEWARE: 'middleware',
    VALIDATOR: 'validator',
    
    // Features
    AUTH: 'auth',
    DATABASE: 'database',
    CACHE: 'cache',
    LOGGING: 'logging',
    METRICS: 'metrics',
    HEALTH: 'health',
    CONFIGURATION: 'configuration',
    
    // Scopes
    SINGLETON: 'singleton',
    TRANSIENT: 'transient',
    SCOPED: 'scoped',
    
    // Auto-discovery
    AUTO_DISCOVERED: 'auto-discovered',
    DECORATED: 'decorated',
    MANUAL: 'manual'
} as const;

// ============================================================================
// TYPE MAPPINGS
// ============================================================================

/**
 * Type mapping for service identifiers
 * Used for type-safe container operations
 */
export interface ServiceTypeMap {
    // Core
    [SERVICE_TYPES.Logger]: import('../../utils/logger').Logger;
    [SERVICE_TYPES.ErrorHandler]: import('../../utils/errorHandler').ErrorHandler;
    [SERVICE_TYPES.Container]: import('./Container').Container;
    
    // Auth
    [SERVICE_TYPES.JWTManager]: import('../../auth/JwtManager').JWTManager;
    [SERVICE_TYPES.JWTService]: import('../../auth/JwtService').JwtService;
    
    // Database
    [SERVICE_TYPES.DatabaseProvider]: import('../../database/interfaces/DatabaseProvider').DatabaseProvider;
    
    // Server
    [SERVICE_TYPES.ServerWrapper]: import('../ServerWrapper').UWebSocketWrapper;
    [SERVICE_TYPES.Router]: import('../routing/Router').Router;
    
    // Config
    [SERVICE_TYPES.Config]: any; // Application config type varies
    [SERVICE_TYPES.ConfigValidator]: import('../ConfigValidator').ConfigValidator;
    
    // HTTP Components
    [SERVICE_TYPES.HttpHandlerWrapper]: import('../server/HttpHandlerWrapper').HttpHandlerWrapper;
    [SERVICE_TYPES.ResponseManager]: import('../server/ResponseManager').ResponseManager;
    [SERVICE_TYPES.RequestManager]: import('../server/RequestManager').RequestManager;
    [SERVICE_TYPES.AuthenticationWrapper]: import('../server/AuthenticationWrapper').AuthenticationWrapper;
    
    // Health & Monitoring
    [SERVICE_TYPES.HealthCheckService]: import('../health/HealthCheckService').HealthCheckService;
    [SERVICE_TYPES.MetricsService]: import('../metrics/MetricsService').MetricsService;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Extract service type from identifier
 */
export type ServiceType<T extends keyof ServiceTypeMap> = ServiceTypeMap[T];

/**
 * Service identifier type guard
 */
export function isServiceType<T extends keyof ServiceTypeMap>(
    identifier: any
): identifier is T {
    return Object.values(SERVICE_TYPES).includes(identifier);
}

/**
 * Get all service types as array
 */
export function getAllServiceTypes(): symbol[] {
    return Object.values(SERVICE_TYPES);
}

/**
 * Get all service tags as array
 */
export function getAllServiceTags(): string[] {
    return Object.values(SERVICE_TAGS);
}



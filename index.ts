/**
 * uW-Wrap - Main entry point
 * Exports all the important classes and functions for external usage
 */

// Core classes
export { ApplicationBootstrap } from './src/core/ApplicationBootstrap';
export { Container } from './src/core/container/Container';
export { ContainerBuilder } from './src/core/container/ContainerBuilder';

// Configuration
export { 
    ApplicationConfig, 
    ServerConfig, 
    AuthConfig,
    createDefaultApplicationConfig,
    createApplicationConfig,
    validateApplicationConfig,
    ApplicationConfigBuilder
} from './src/core/container/ApplicationConfig';

// Discovery system
export { AutoDiscovery } from './src/core/AutoDiscovery';
export { DiscoveryConfig } from './src/core/discovery/DiscoveryConfig';

// Decorators
export { Route, GET, POST, PUT, DELETE, PATCH } from './src/core/decorators/RouteDecorators';

// Middleware and Context
export { MiddlewareContext } from './src/middleware/AuthenticationMiddleware';
export { HttpHandler } from './src/core/HttpHandler';

// Services
export { SERVICE_TYPES } from './src/core/container/ServiceTypes';

// Utilities
export { Logger } from './src/utils/logger';
export { ErrorHandler } from './src/utils/errorHandler';

// Types and interfaces
export { 
    BootstrapResult, 
    BootstrapOptions,
    startApplication 
} from './src/core/ApplicationBootstrap';

export {
    AutoDiscoveryOptions,
    AutoDiscoveryResult
} from './src/core/AutoDiscovery';

// Auth
export { JwtService } from './src/auth/JwtService';
export { JWTManager } from './src/auth/jwtManager';

// Re-export commonly used types
export type {
    ComponentPatterns,
    DiscoveryConfiguration
} from './src/core/discovery/DiscoveryConfig';

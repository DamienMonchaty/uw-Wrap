/**
 * Application-specific service identifiers
 * Extends the base TYPES from the wrapper core
 */

// Import base types from the wrapper
import { TYPES as BASE_TYPES } from '../../src/core/ioc-container';

/**
 * Extended service identifiers for this application
 */
export const TYPES = {
    // Include all base types
    ...BASE_TYPES,
    
    // Application-specific services
    AppRepositoryManager: Symbol.for('AppRepositoryManager'),
    UserService: Symbol.for('UserService'),
} as const;

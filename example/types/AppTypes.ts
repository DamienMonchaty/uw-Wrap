/**
 * Application-specific service identifiers
 * Extends the base TYPES from the wrapper core
 */

// Import base types from the wrapper
import { TYPES as BASE_TYPES } from '../../src/core/Container';

/**
 * Extended service identifiers for this application
 */
export const APP_TYPES = {
    // Include all base types
    ...BASE_TYPES,
    
    // Application-specific services
    AppRepositoryManager: Symbol.for('AppRepositoryManager'),
    UserService: Symbol.for('UserService'),
} as const;

// Re-export for convenience
export { APP_TYPES as TYPES };

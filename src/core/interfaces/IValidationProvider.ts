/**
 * Validation Provider Interface
 * Generic validation system that can be implemented with any validation library
 */

/**
 * Validation context for custom validators
 */
export interface ValidationContext {
    /** Current environment (development, production, etc.) */
    environment?: string;
    /** Request or operation context */
    request?: any;
    /** Additional metadata */
    metadata?: Record<string, any>;
}

/**
 * Validation error details
 */
export interface ValidationError {
    /** Field name that failed validation */
    field: string;
    /** Error message */
    message: string;
    /** The invalid value */
    value: any;
    /** Error code for programmatic handling */
    code?: string;
}

/**
 * Validation rule definition
 */
export interface ValidationRule {
    /** Type of validation rule */
    type: 'required' | 'optional' | 'string' | 'number' | 'boolean' | 'array' | 'object' | 
          'email' | 'url' | 'min' | 'max' | 'pattern' | 'enum' | 'custom';
    /** Custom error message */
    message?: string;
    /** Rule value (for min, max, pattern, enum rules) */
    value?: any;
    /** Default value to apply if field is missing */
    defaultValue?: any;
    /** Continue validation even if this rule fails */
    continueOnError?: boolean;
    /** Custom validator function */
    validator?: (value: any, context?: ValidationContext) => Promise<boolean | string> | boolean | string;
}

/**
 * Validation schema definition
 */
export interface ValidationSchema {
    /** Field validation rules */
    fields: Record<string, ValidationRule[]>;
    /** Schema-level validators */
    validators?: Array<(data: any, context?: ValidationContext) => Promise<boolean | string> | boolean | string>;
    /** Schema metadata */
    metadata?: Record<string, any>;
}

/**
 * Validation result
 */
export interface ValidationResult<T = any> {
    /** Whether validation passed */
    valid: boolean;
    /** Validated and transformed data */
    data: T;
    /** Validation errors */
    errors: ValidationError[];
    /** Validation warnings */
    warnings: ValidationError[];
    /** Validation duration in milliseconds */
    duration: number;
}

/**
 * Generic validation provider interface
 * Implement this interface to integrate any validation library
 */
export interface IValidationProvider {
    /**
     * Validate data against a schema
     * @param data Data to validate
     * @param schema Validation schema or schema name
     * @param context Optional validation context
     */
    validate<T = any>(data: any, schema: ValidationSchema | string, context?: ValidationContext): Promise<ValidationResult<T>>;

    /**
     * Register a validation schema by name
     * @param name Schema name
     * @param schema Schema definition
     */
    registerSchema(name: string, schema: ValidationSchema): void;

    /**
     * Get a registered schema by name
     * @param name Schema name
     */
    getSchema(name: string): ValidationSchema | undefined;
}

/**
 * Validation service configuration
 */
export interface ValidationServiceConfig {
    /** Validation provider instance */
    provider?: IValidationProvider;
    /** Enable validation caching */
    enableCaching?: boolean;
    /** Default validation context */
    defaultContext?: ValidationContext;
    /** Enable performance metrics */
    enableMetrics?: boolean;
}
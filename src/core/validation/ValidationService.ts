/**
 * Injectable Validation Service
 * Dependency-injected service with pluggable validation providers
 */

import {
    IValidationProvider,
    ValidationServiceConfig,
    ValidationSchema,
    ValidationResult,
    ValidationError,
    ValidationContext
} from '../interfaces/IValidationProvider';
import { NativeValidationProvider } from './NativeValidationProvider';
import { Service } from '../AutoRegistration';

/**
 * Validation Service with dependency injection support
 * Supports multiple validation backends through provider injection
 */
@Service('ValidationService')
export class ValidationService {
    private provider: IValidationProvider;
    private cachingEnabled: boolean;
    private metricsEnabled: boolean;
    private defaultContext: ValidationContext;
    private validationCache: Map<string, ValidationResult> = new Map();
    private metrics: {
        totalValidations: number;
        successfulValidations: number;
        failedValidations: number;
        totalDuration: number;
        cacheHits: number;
    } = {
        totalValidations: 0,
        successfulValidations: 0,
        failedValidations: 0,
        totalDuration: 0,
        cacheHits: 0
    };

    constructor(config: ValidationServiceConfig = {}) {
        this.provider = config.provider || new NativeValidationProvider();
        this.cachingEnabled = config.enableCaching !== false;
        this.metricsEnabled = config.enableMetrics !== false;
        this.defaultContext = config.defaultContext || {};
    }

    /**
     * Validate data against a schema
     */
    async validate<T = any>(
        data: any, 
        schema: ValidationSchema | string, 
        context?: ValidationContext
    ): Promise<ValidationResult<T>> {
        const mergedContext = { ...this.defaultContext, ...context };
        const cacheKey = this.cachingEnabled ? this.generateCacheKey(data, schema, mergedContext) : null;
        
        // Check cache first
        if (cacheKey && this.validationCache.has(cacheKey)) {
            this.updateMetrics('cache-hit');
            return this.validationCache.get(cacheKey)! as ValidationResult<T>;
        }

        // Perform validation
        const startTime = Date.now();
        const result = await this.provider.validate<T>(data, schema, mergedContext);
        
        // Update metrics
        this.updateMetrics('validation', result, Date.now() - startTime);
        
        // Cache result if enabled
        if (cacheKey && result.valid) {
            this.validationCache.set(cacheKey, result);
        }

        return result;
    }

    /**
     * Validate data and throw on error
     */
    async validateOrThrow<T = any>(
        data: any, 
        schema: ValidationSchema | string, 
        context?: ValidationContext
    ): Promise<T> {
        const result = await this.validate<T>(data, schema, context);
        
        if (!result.valid) {
            const error = new ValidationFailedError('Validation failed', result.errors);
            throw error;
        }

        return result.data;
    }

    /**
     * Register a validation schema
     */
    registerSchema(name: string, schema: ValidationSchema): void {
        this.provider.registerSchema(name, schema);
        // Clear cache when schema changes
        if (this.cachingEnabled) {
            this.clearCache();
        }
    }

    /**
     * Get a registered schema
     */
    getSchema(name: string): ValidationSchema | undefined {
        return this.provider.getSchema(name);
    }

    /**
     * Validate multiple objects
     */
    async validateBatch<T = any>(
        items: any[], 
        schema: ValidationSchema | string, 
        context?: ValidationContext
    ): Promise<ValidationResult<T>[]> {
        const results: ValidationResult<T>[] = [];
        
        for (const item of items) {
            const result = await this.validate<T>(item, schema, context);
            results.push(result);
        }

        return results;
    }

    /**
     * Validation decorator for methods
     */
    validationDecorator<T>(
        schema: ValidationSchema | string,
        options: {
            /** Parameter index to validate (default: 0) */
            paramIndex?: number;
            /** Context to use for validation */
            context?: ValidationContext;
            /** Transform result after validation */
            transform?: boolean;
        } = {}
    ) {
        const validationService = this;
        
        return (target: any, propertyName: string, descriptor: PropertyDescriptor) => {
            const method = descriptor.value;
            const paramIndex = options.paramIndex || 0;

            descriptor.value = async function (...args: any[]): Promise<any> {
                // Validate the specified parameter
                if (args[paramIndex] !== undefined) {
                    const result = await validationService.validate(
                        args[paramIndex], 
                        schema, 
                        options.context
                    );

                    if (!result.valid) {
                        throw new ValidationFailedError(
                            `Validation failed for ${target.constructor.name}.${propertyName}`,
                            result.errors
                        );
                    }

                    // Replace with validated/transformed data if enabled
                    if (options.transform) {
                        args[paramIndex] = result.data;
                    }
                }

                // Execute original method
                return method.apply(this, args);
            };

            return descriptor;
        };
    }

    /**
     * Create validation middleware for web frameworks
     */
    createValidationMiddleware(
        schema: ValidationSchema | string,
        options: {
            /** Where to find data to validate */
            source?: 'body' | 'query' | 'params' | 'headers';
            /** Transform request with validated data */
            transform?: boolean;
            /** Context generator function */
            contextGenerator?: (req: any) => ValidationContext;
        } = {}
    ) {
        const validationService = this;
        const source = options.source || 'body';
        
        return async (req: any, res: any, next?: Function) => {
            try {
                const dataToValidate = req[source];
                const context = options.contextGenerator ? options.contextGenerator(req) : undefined;
                
                const result = await validationService.validate(dataToValidate, schema, context);
                
                if (!result.valid) {
                    const error = new ValidationFailedError('Request validation failed', result.errors);
                    if (next) {
                        return next(error);
                    }
                    throw error;
                }

                // Transform request with validated data if enabled
                if (options.transform) {
                    req[source] = result.data;
                }

                // Add validation result to request
                req.validationResult = result;

                if (next) {
                    next();
                }
            } catch (error) {
                if (next) {
                    next(error);
                } else {
                    throw error;
                }
            }
        };
    }

    /**
     * Get validation metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            averageDuration: this.metrics.totalValidations > 0 
                ? this.metrics.totalDuration / this.metrics.totalValidations 
                : 0,
            successRate: this.metrics.totalValidations > 0 
                ? this.metrics.successfulValidations / this.metrics.totalValidations 
                : 0,
            cacheHitRate: this.metrics.totalValidations > 0 
                ? this.metrics.cacheHits / this.metrics.totalValidations 
                : 0
        };
    }

    /**
     * Clear validation cache
     */
    clearCache(): void {
        this.validationCache.clear();
    }

    /**
     * Reset metrics
     */
    resetMetrics(): void {
        this.metrics = {
            totalValidations: 0,
            successfulValidations: 0,
            failedValidations: 0,
            totalDuration: 0,
            cacheHits: 0
        };
    }

    /**
     * Health check for validation service
     */
    async healthCheck(): Promise<{
        name: string;
        status: 'pass' | 'warn' | 'fail';
        duration: number;
        message?: string;
        metrics?: any;
    }> {
        const startTime = Date.now();
        
        try {
            // Test basic validation functionality
            const testSchema: ValidationSchema = {
                fields: {
                    test: [{ type: 'required' }, { type: 'string' }]
                }
            };
            
            const testData = { test: 'health-check' };
            const result = await this.provider.validate(testData, testSchema);
            
            const duration = Date.now() - startTime;
            
            if (result.valid) {
                return {
                    name: 'validation',
                    status: 'pass',
                    duration,
                    message: 'Validation system is healthy',
                    metrics: this.metricsEnabled ? this.getMetrics() : undefined
                };
            } else {
                return {
                    name: 'validation',
                    status: 'fail',
                    duration,
                    message: 'Validation test failed'
                };
            }
        } catch (error) {
            return {
                name: 'validation',
                status: 'fail',
                duration: Date.now() - startTime,
                message: `Validation error: ${(error as Error).message}`
            };
        }
    }

    /**
     * Shutdown the validation service
     */
    async shutdown(): Promise<void> {
        this.clearCache();
        this.resetMetrics();
    }

    /**
     * Get the underlying provider (for advanced usage)
     */
    getProvider(): IValidationProvider {
        return this.provider;
    }

    /**
     * Generate cache key for validation result
     */
    private generateCacheKey(data: any, schema: ValidationSchema | string, context: ValidationContext): string {
        const schemaKey = typeof schema === 'string' ? schema : JSON.stringify(schema);
        const dataKey = JSON.stringify(data);
        const contextKey = JSON.stringify(context);
        return `${schemaKey}:${dataKey}:${contextKey}`;
    }

    /**
     * Update validation metrics
     */
    private updateMetrics(type: 'validation' | 'cache-hit', result?: ValidationResult, duration?: number): void {
        if (!this.metricsEnabled) return;

        if (type === 'cache-hit') {
            this.metrics.cacheHits++;
            return;
        }

        if (type === 'validation' && result && duration !== undefined) {
            this.metrics.totalValidations++;
            this.metrics.totalDuration += duration;
            
            if (result.valid) {
                this.metrics.successfulValidations++;
            } else {
                this.metrics.failedValidations++;
            }
        }
    }
}

/**
 * Custom validation error class
 */
export class ValidationFailedError extends Error {
    public readonly errors: ValidationError[];
    
    constructor(message: string, errors: ValidationError[]) {
        super(message);
        this.name = 'ValidationFailedError';
        this.errors = errors;
    }

    /**
     * Get formatted error message
     */
    getFormattedMessage(): string {
        const errorMessages = this.errors.map(err => `${err.field}: ${err.message}`);
        return `${this.message}\n${errorMessages.join('\n')}`;
    }

    /**
     * Get errors for a specific field
     */
    getFieldErrors(fieldName: string): ValidationError[] {
        return this.errors.filter(err => err.field === fieldName);
    }
}
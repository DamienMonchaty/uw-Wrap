/**
 * Separated Validation Middleware
 * Single responsibility: Request validation using schemas
 */

import { Middleware, MiddlewareContext, NextFunction } from './AuthenticationMiddleware';

export interface ValidationSchema {
    type?: string;
    required?: string[];
    properties?: Record<string, any>;
    additionalProperties?: boolean;
}

export interface ValidationResult {
    valid: boolean;
    errors: string[];
    data?: any;
}

export interface ValidationOptions {
    validateBody?: boolean;
    validateQuery?: boolean;
    validateParams?: boolean;
    abortEarly?: boolean;
}

/**
 * Validation Middleware - Single responsibility: Request validation
 */
export class ValidationMiddleware extends Middleware {
    
    constructor(
        private schema: ValidationSchema,
        private options: ValidationOptions = {
            validateBody: true,
            validateQuery: false,
            validateParams: false,
            abortEarly: true
        }
    ) {
        super();
    }

    async execute(context: MiddlewareContext, next: NextFunction): Promise<void> {
        const validationErrors: string[] = [];

        // Validate body if needed
        if (this.options.validateBody && this.shouldValidateBody(context.method)) {
            if (!context.body) {
                context.body = await this.readBody(context.res);
            }
            
            const bodyResult = this.validateData(context.body, this.schema);
            if (!bodyResult.valid) {
                validationErrors.push(...bodyResult.errors.map(err => `Body: ${err}`));
                
                if (this.options.abortEarly) {
                    this.throwValidationError(validationErrors);
                }
            }
        }

        // Validate query parameters if needed
        if (this.options.validateQuery && context.query) {
            const queryResult = this.validateData(context.query, this.schema);
            if (!queryResult.valid) {
                validationErrors.push(...queryResult.errors.map(err => `Query: ${err}`));
                
                if (this.options.abortEarly) {
                    this.throwValidationError(validationErrors);
                }
            }
        }

        // Validate path parameters if needed
        if (this.options.validateParams && context.params) {
            const paramsResult = this.validateData(context.params, this.schema);
            if (!paramsResult.valid) {
                validationErrors.push(...paramsResult.errors.map(err => `Params: ${err}`));
                
                if (this.options.abortEarly) {
                    this.throwValidationError(validationErrors);
                }
            }
        }

        // If we have errors and not aborting early, throw now
        if (validationErrors.length > 0) {
            this.throwValidationError(validationErrors);
        }

        await next();
    }

    private shouldValidateBody(method?: string): boolean {
        const methodsWithBody = ['post', 'put', 'patch'];
        return methodsWithBody.includes(method?.toLowerCase() || '');
    }

    private async readBody(res: any): Promise<any> {
        return new Promise((resolve, reject) => {
            let buffer = '';
            
            res.onData((chunk: ArrayBuffer, isLast: boolean) => {
                buffer += Buffer.from(chunk).toString();
                
                if (isLast) {
                    try {
                        const parsed = buffer ? JSON.parse(buffer) : {};
                        resolve(parsed);
                    } catch (error) {
                        reject(new Error('Invalid JSON in request body'));
                    }
                }
            });
            
            res.onAborted(() => {
                reject(new Error('Request was aborted'));
            });
        });
    }

    private validateData(data: any, schema: ValidationSchema): ValidationResult {
        const errors: string[] = [];

        // Check required fields
        if (schema.required) {
            for (const field of schema.required) {
                if (!(field in data) || data[field] === null || data[field] === undefined || data[field] === '') {
                    errors.push(`Field '${field}' is required`);
                }
            }
        }

        // Check properties
        if (schema.properties) {
            for (const [field, fieldSchema] of Object.entries(schema.properties)) {
                if (field in data) {
                    const fieldErrors = this.validateField(data[field], fieldSchema, field);
                    errors.push(...fieldErrors);
                }
            }
        }

        // Check additional properties
        if (schema.additionalProperties === false && schema.properties) {
            const allowedFields = Object.keys(schema.properties);
            for (const field of Object.keys(data)) {
                if (!allowedFields.includes(field)) {
                    errors.push(`Field '${field}' is not allowed`);
                }
            }
        }

        return {
            valid: errors.length === 0,
            errors,
            data: errors.length === 0 ? data : undefined
        };
    }

    private validateField(value: any, schema: any, fieldName: string): string[] {
        const errors: string[] = [];

        // Type validation
        if (schema.type && typeof value !== schema.type) {
            errors.push(`Field '${fieldName}' must be of type ${schema.type}, got ${typeof value}`);
            return errors; // Skip other validations if type is wrong
        }

        // String validations
        if (schema.type === 'string' && typeof value === 'string') {
            if (schema.minLength && value.length < schema.minLength) {
                errors.push(`Field '${fieldName}' must be at least ${schema.minLength} characters long`);
            }
            
            if (schema.maxLength && value.length > schema.maxLength) {
                errors.push(`Field '${fieldName}' must be at most ${schema.maxLength} characters long`);
            }
            
            if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
                errors.push(`Field '${fieldName}' does not match the required pattern`);
            }
            
            if (schema.format) {
                const formatError = this.validateFormat(value, schema.format, fieldName);
                if (formatError) {
                    errors.push(formatError);
                }
            }
        }

        // Number validations
        if (schema.type === 'number' && typeof value === 'number') {
            if (schema.minimum !== undefined && value < schema.minimum) {
                errors.push(`Field '${fieldName}' must be at least ${schema.minimum}`);
            }
            
            if (schema.maximum !== undefined && value > schema.maximum) {
                errors.push(`Field '${fieldName}' must be at most ${schema.maximum}`);
            }
        }

        // Array validations
        if (schema.type === 'array' && Array.isArray(value)) {
            if (schema.minItems !== undefined && value.length < schema.minItems) {
                errors.push(`Field '${fieldName}' must have at least ${schema.minItems} items`);
            }
            
            if (schema.maxItems !== undefined && value.length > schema.maxItems) {
                errors.push(`Field '${fieldName}' must have at most ${schema.maxItems} items`);
            }
            
            if (schema.items) {
                value.forEach((item, index) => {
                    const itemErrors = this.validateField(item, schema.items, `${fieldName}[${index}]`);
                    errors.push(...itemErrors);
                });
            }
        }

        // Enum validation
        if (schema.enum && !schema.enum.includes(value)) {
            errors.push(`Field '${fieldName}' must be one of: ${schema.enum.join(', ')}`);
        }

        return errors;
    }

    private validateFormat(value: string, format: string, fieldName: string): string | null {
        switch (format) {
            case 'email':
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                    return `Field '${fieldName}' must be a valid email address`;
                }
                break;
                
            case 'url':
                try {
                    new URL(value);
                } catch {
                    return `Field '${fieldName}' must be a valid URL`;
                }
                break;
                
            case 'uuid':
                if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
                    return `Field '${fieldName}' must be a valid UUID`;
                }
                break;
                
            case 'date':
                if (isNaN(Date.parse(value))) {
                    return `Field '${fieldName}' must be a valid date`;
                }
                break;
                
            default:
                // Unknown format, skip validation
                break;
        }
        
        return null;
    }

    private throwValidationError(errors: string[]): never {
        const error = new Error(`Validation failed: ${errors.join(', ')}`);
        (error as any).statusCode = 400;
        (error as any).validationErrors = errors;
        throw error;
    }
}

/**
 * Validation decorators
 * Following Single Responsibility Principle - only validation-related decorators
 */

import { MetadataUtils } from './MetadataUtils';
import { ValidationOptions } from './types';

// =============================================================================
// VALIDATION DECORATORS
// =============================================================================

/**
 * Validation decorator
 * Validates request data against a schema
 * @param schema - Validation schema (can be Joi, Yup, or custom schema)
 * @example @Validate(userSchema) or @Validate({ name: 'required', email: 'email' })
 */
export function Validate(schema: any): MethodDecorator {
    return function (target: any, propertyKey: string | symbol | undefined, descriptor?: PropertyDescriptor) {
        const key = propertyKey as string;
        
        const options: ValidationOptions = {
            schema
        };

        MetadataUtils.addMiddleware(target, key, {
            type: 'validate',
            options
        });
    };
}

/**
 * Validate request body only
 * @param schema - Schema for body validation
 * @example @ValidateBody(createUserSchema)
 */
export function ValidateBody(schema: any): MethodDecorator {
    return function (target: any, propertyKey: string | symbol | undefined, descriptor?: PropertyDescriptor) {
        const key = propertyKey as string;
        
        MetadataUtils.addMiddleware(target, key, {
            type: 'validate',
            options: {
                schema,
                target: 'body'
            }
        });
    };
}

/**
 * Validate query parameters only
 * @param schema - Schema for query validation
 * @example @ValidateQuery(searchQuerySchema)
 */
export function ValidateQuery(schema: any): MethodDecorator {
    return function (target: any, propertyKey: string | symbol | undefined, descriptor?: PropertyDescriptor) {
        const key = propertyKey as string;
        
        MetadataUtils.addMiddleware(target, key, {
            type: 'validate',
            options: {
                schema,
                target: 'query'
            }
        });
    };
}

/**
 * Validate path parameters only
 * @param schema - Schema for params validation
 * @example @ValidateParams({ id: 'number' })
 */
export function ValidateParams(schema: any): MethodDecorator {
    return function (target: any, propertyKey: string | symbol | undefined, descriptor?: PropertyDescriptor) {
        const key = propertyKey as string;
        
        MetadataUtils.addMiddleware(target, key, {
            type: 'validate',
            options: {
                schema,
                target: 'params'
            }
        });
    };
}

/**
 * Validate headers only
 * @param schema - Schema for headers validation
 * @example @ValidateHeaders({ 'content-type': 'application/json' })
 */
export function ValidateHeaders(schema: any): MethodDecorator {
    return function (target: any, propertyKey: string | symbol | undefined, descriptor?: PropertyDescriptor) {
        const key = propertyKey as string;
        
        MetadataUtils.addMiddleware(target, key, {
            type: 'validate',
            options: {
                schema,
                target: 'headers'
            }
        });
    };
}

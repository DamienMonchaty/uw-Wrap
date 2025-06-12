/**
 * Native Validation Provider
 * Built-in validation implementation without external dependencies
 */

import {
    IValidationProvider,
    ValidationSchema,
    ValidationResult,
    ValidationError,
    ValidationRule,
    ValidationContext
} from '../interfaces/IValidationProvider';

/**
 * Native validation provider with common built-in rules
 */
export class NativeValidationProvider implements IValidationProvider {
    private schemas: Map<string, ValidationSchema> = new Map();

    /**
     * Register a validation schema
     */
    registerSchema(name: string, schema: ValidationSchema): void {
        this.schemas.set(name, schema);
    }

    /**
     * Validate data against a schema
     */
    async validate<T = any>(data: any, schema: ValidationSchema | string, context?: ValidationContext): Promise<ValidationResult<T>> {
        const startTime = Date.now();
        const validationSchema = typeof schema === 'string' ? this.schemas.get(schema) : schema;
        
        if (!validationSchema) {
            return {
                valid: false,
                data: data,
                errors: [{
                    field: '__schema__',
                    message: `Schema not found: ${schema}`,
                    value: schema
                }],
                warnings: [],
                duration: Date.now() - startTime
            };
        }

        const errors: ValidationError[] = [];
        const warnings: ValidationError[] = [];
        const validatedData: any = {};

        // Validate each field in the schema
        for (const [fieldName, fieldRules] of Object.entries(validationSchema.fields)) {
            const fieldValue = this.getNestedValue(data, fieldName);
            const fieldResult = await this.validateField(fieldName, fieldValue, fieldRules as ValidationRule[], context);
            
            errors.push(...fieldResult.errors);
            warnings.push(...fieldResult.warnings);
            
            if (fieldResult.transformedValue !== undefined) {
                this.setNestedValue(validatedData, fieldName, fieldResult.transformedValue);
            }
        }

        // Apply defaults for missing fields
        this.applyDefaults(validatedData, validationSchema);

        // Run schema-level validators
        if (validationSchema.validators) {
            for (const validator of validationSchema.validators) {
                try {
                    const result = await validator(validatedData, context);
                    if (result !== true) {
                        errors.push({
                            field: '__schema__',
                            message: typeof result === 'string' ? result : 'Schema validation failed',
                            value: validatedData
                        });
                    }
                } catch (error) {
                    errors.push({
                        field: '__schema__',
                        message: `Schema validator error: ${(error as Error).message}`,
                        value: validatedData
                    });
                }
            }
        }

        return {
            valid: errors.length === 0,
            data: validatedData as T,
            errors,
            warnings,
            duration: Date.now() - startTime
        };
    }

    /**
     * Validate a single field
     */
    private async validateField(
        fieldName: string,
        value: any,
        rules: ValidationRule[],
        context?: ValidationContext
    ): Promise<{
        errors: ValidationError[];
        warnings: ValidationError[];
        transformedValue?: any;
    }> {
        const errors: ValidationError[] = [];
        const warnings: ValidationError[] = [];
        let transformedValue = value;

        for (const rule of rules) {
            try {
                const result = await this.applyRule(fieldName, transformedValue, rule, context);
                
                if (result.valid) {
                    if (result.transformedValue !== undefined) {
                        transformedValue = result.transformedValue;
                    }
                    if (result.warning) {
                        warnings.push({
                            field: fieldName,
                            message: result.warning,
                            value: transformedValue
                        });
                    }
                } else {
                    errors.push({
                        field: fieldName,
                        message: result.error || `Validation failed for rule: ${rule.type}`,
                        value: transformedValue
                    });
                    
                    // Stop validation on first error unless rule allows continuation
                    if (!rule.continueOnError) {
                        break;
                    }
                }
            } catch (error) {
                errors.push({
                    field: fieldName,
                    message: `Rule execution error: ${(error as Error).message}`,
                    value: transformedValue
                });
                break;
            }
        }

        return { errors, warnings, transformedValue };
    }

    /**
     * Apply a single validation rule
     */
    private async applyRule(
        fieldName: string,
        value: any,
        rule: ValidationRule,
        context?: ValidationContext
    ): Promise<{
        valid: boolean;
        error?: string;
        warning?: string;
        transformedValue?: any;
    }> {
        // Handle undefined/null values
        if (value === undefined || value === null) {
            if (rule.type === 'required') {
                return { valid: false, error: rule.message || `${fieldName} is required` };
            }
            if (rule.defaultValue !== undefined) {
                return { valid: true, transformedValue: rule.defaultValue };
            }
            if (rule.type !== 'optional') {
                return { valid: true }; // Skip validation for undefined optional fields
            }
        }

        // Built-in rule types
        switch (rule.type) {
            case 'required':
                return { valid: value !== undefined && value !== null && value !== '' };

            case 'optional':
                return { valid: true };

            case 'string':
                if (typeof value !== 'string') {
                    return { valid: false, error: rule.message || `${fieldName} must be a string` };
                }
                return { valid: true };

            case 'number':
                const num = Number(value);
                if (isNaN(num)) {
                    return { valid: false, error: rule.message || `${fieldName} must be a number` };
                }
                return { valid: true, transformedValue: num };

            case 'boolean':
                if (typeof value === 'boolean') {
                    return { valid: true };
                }
                if (typeof value === 'string') {
                    const lower = value.toLowerCase();
                    if (lower === 'true' || lower === 'false') {
                        return { valid: true, transformedValue: lower === 'true' };
                    }
                }
                return { valid: false, error: rule.message || `${fieldName} must be a boolean` };

            case 'array':
                if (!Array.isArray(value)) {
                    return { valid: false, error: rule.message || `${fieldName} must be an array` };
                }
                return { valid: true };

            case 'object':
                if (typeof value !== 'object' || Array.isArray(value)) {
                    return { valid: false, error: rule.message || `${fieldName} must be an object` };
                }
                return { valid: true };

            case 'email':
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(String(value))) {
                    return { valid: false, error: rule.message || `${fieldName} must be a valid email` };
                }
                return { valid: true };

            case 'url':
                try {
                    new URL(String(value));
                    return { valid: true };
                } catch {
                    return { valid: false, error: rule.message || `${fieldName} must be a valid URL` };
                }

            case 'min':
                if (typeof value === 'number' && value < (rule.value as number)) {
                    return { valid: false, error: rule.message || `${fieldName} must be at least ${rule.value}` };
                }
                if (typeof value === 'string' && value.length < (rule.value as number)) {
                    return { valid: false, error: rule.message || `${fieldName} must be at least ${rule.value} characters` };
                }
                return { valid: true };

            case 'max':
                if (typeof value === 'number' && value > (rule.value as number)) {
                    return { valid: false, error: rule.message || `${fieldName} must be at most ${rule.value}` };
                }
                if (typeof value === 'string' && value.length > (rule.value as number)) {
                    return { valid: false, error: rule.message || `${fieldName} must be at most ${rule.value} characters` };
                }
                return { valid: true };

            case 'pattern':
                const regex = rule.value as RegExp;
                if (!regex.test(String(value))) {
                    return { valid: false, error: rule.message || `${fieldName} does not match required pattern` };
                }
                return { valid: true };

            case 'enum':
                const allowedValues = rule.value as any[];
                if (!allowedValues.includes(value)) {
                    return { valid: false, error: rule.message || `${fieldName} must be one of: ${allowedValues.join(', ')}` };
                }
                return { valid: true };

            case 'custom':
                if (rule.validator) {
                    const result = await rule.validator(value, context);
                    if (result === true) {
                        return { valid: true };
                    }
                    return { 
                        valid: false, 
                        error: typeof result === 'string' ? result : (rule.message || 'Custom validation failed')
                    };
                }
                return { valid: true };

            default:
                return { valid: true, warning: `Unknown validation rule type: ${rule.type}` };
        }
    }

    /**
     * Apply default values to validated data
     */
    private applyDefaults(data: any, schema: ValidationSchema): void {
        for (const [fieldName, rules] of Object.entries(schema.fields)) {
            const currentValue = this.getNestedValue(data, fieldName);
            if (currentValue === undefined) {
                const fieldRules = rules as ValidationRule[];
                const defaultRule = fieldRules.find((rule: ValidationRule) => rule.defaultValue !== undefined);
                if (defaultRule) {
                    this.setNestedValue(data, fieldName, defaultRule.defaultValue);
                }
            }
        }
    }

    /**
     * Get nested value from object using dot notation
     */
    private getNestedValue(obj: any, path: string): any {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }

    /**
     * Set nested value in object using dot notation
     */
    private setNestedValue(obj: any, path: string, value: any): void {
        const keys = path.split('.');
        const lastKey = keys.pop()!;
        const target = keys.reduce((current, key) => {
            if (current[key] === undefined) {
                current[key] = {};
            }
            return current[key];
        }, obj);
        target[lastKey] = value;
    }

    /**
     * Get registered schema
     */
    getSchema(name: string): ValidationSchema | undefined {
        return this.schemas.get(name);
    }

    /**
     * List all registered schema names
     */
    getSchemaNames(): string[] {
        return Array.from(this.schemas.keys());
    }

    /**
     * Clear all registered schemas
     */
    clearSchemas(): void {
        this.schemas.clear();
    }
}
/**
 * Configuration Validator - Modern version
 * Uses the new ApplicationConfig system exclusively
 */

import { ApplicationConfig, validateApplicationConfig } from './container/ApplicationConfig';

export interface ConfigValidatorOptions {
    /** Enable detailed logging */
    enableLogging?: boolean;
    /** Custom validation rules */
    customRules?: ValidationRule[];
}

export interface ValidationResult {
    valid: boolean;
    config: ApplicationConfig;
    errors: string[];
    warnings: string[];
}

export interface ValidationRule {
    path: string;
    required?: boolean;
    type?: 'string' | 'number' | 'boolean' | 'object';
    default?: any;
    validate?: (value: any) => boolean;
    message?: string;
}

/**
 * Modern Configuration Validator
 * Single responsibility: Application configuration validation
 */
export class ConfigValidator {
    private enableLogging: boolean;
    private customRules: ValidationRule[];

    constructor(options: ConfigValidatorOptions = {}) {
        this.enableLogging = options.enableLogging !== false;
        this.customRules = options.customRules || [];
    }

    /**
     * Validate and apply defaults to configuration
     */
    async validateAndApplyDefaults(config: unknown): Promise<ValidationResult> {
        try {
            // Use the modern validation system
            const validatedConfig = await validateApplicationConfig(config);
            
            // Apply custom validation rules if any
            const customValidation = this.applyCustomRules(validatedConfig);
            
            const result = {
                valid: customValidation.errors.length === 0,
                config: validatedConfig,
                errors: customValidation.errors,
                warnings: customValidation.warnings
            };

            if (this.enableLogging) {
                if (!result.valid) {
                    console.error('❌ Configuration validation errors:', result.errors);
                }
                if (result.warnings.length > 0) {
                    console.warn('⚠️ Configuration validation warnings:', result.warnings);
                }
            }

            return result;
        } catch (error) {
            if (this.enableLogging) {
                console.error('❌ Configuration validation failed:', error);
            }
            
            throw new Error(`Configuration validation failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Synchronous validation for compatibility
     */
    validateSync(config: unknown): ValidationResult {
        try {
            // Basic synchronous validation
            const errors: string[] = [];
            const warnings: string[] = [];
            
            // Type check
            if (!config || typeof config !== 'object') {
                errors.push('Configuration must be an object');
                return {
                    valid: false,
                    config: config as ApplicationConfig,
                    errors,
                    warnings
                };
            }

            const configObj = config as any;

            // Basic required field validation
            if (!configObj.server?.port) {
                if (typeof configObj.port === 'number') {
                    // Migrate legacy format
                    configObj.server = { ...configObj.server, port: configObj.port };
                    warnings.push('Legacy port configuration migrated to server.port');
                } else {
                    errors.push('server.port is required');
                }
            }

            if (!configObj.auth?.jwtSecret) {
                if (typeof configObj.jwtSecret === 'string') {
                    // Migrate legacy format
                    configObj.auth = { ...configObj.auth, jwtSecret: configObj.jwtSecret };
                    warnings.push('Legacy jwtSecret configuration migrated to auth.jwtSecret');
                } else {
                    errors.push('auth.jwtSecret is required');
                }
            }

            if (!configObj.database) {
                errors.push('database configuration is required');
            }

            // Apply custom rules
            const customValidation = this.applyCustomRules(configObj);
            errors.push(...customValidation.errors);
            warnings.push(...customValidation.warnings);

            return {
                valid: errors.length === 0,
                config: configObj as ApplicationConfig,
                errors,
                warnings
            };
        } catch (error) {
            throw new Error(`Synchronous validation failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Apply custom validation rules
     */
    private applyCustomRules(config: any): { errors: string[]; warnings: string[] } {
        const errors: string[] = [];
        const warnings: string[] = [];

        for (const rule of this.customRules) {
            try {
                const value = this.getNestedValue(config, rule.path);
                
                if (value === undefined) {
                    if (rule.required) {
                        errors.push(rule.message || `${rule.path} is required`);
                    } else if (rule.default !== undefined) {
                        this.setNestedValue(config, rule.path, rule.default);
                        warnings.push(`Applied default value for ${rule.path}`);
                    }
                } else {
                    // Type validation
                    if (rule.type && typeof value !== rule.type) {
                        if (rule.type === 'number' && !isNaN(Number(value))) {
                            this.setNestedValue(config, rule.path, Number(value));
                            warnings.push(`Converted ${rule.path} to number`);
                        } else {
                            errors.push(rule.message || `${rule.path} must be of type ${rule.type}`);
                        }
                    }
                    
                    // Custom validation
                    if (rule.validate && !rule.validate(value)) {
                        errors.push(rule.message || `${rule.path} validation failed`);
                    }
                }
            } catch (error) {
                errors.push(`Validation error for ${rule.path}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }

        return { errors, warnings };
    }

    /**
     * Create validation report
     */
    createReport(validation: ValidationResult): string {
        const report = [];
        
        report.push('=== Configuration Validation Report ===');
        report.push(`Status: ${validation.valid ? '✅ VALID' : '❌ INVALID'}`);
        
        if (validation.errors.length > 0) {
            report.push('\n🚫 Errors:');
            validation.errors.forEach(error => report.push(`  - ${error}`));
        }
        
        if (validation.warnings.length > 0) {
            report.push('\n⚠️ Warnings:');
            validation.warnings.forEach(warning => report.push(`  - ${warning}`));
        }
        
        report.push('=====================================');
        
        return report.join('\n');
    }

    /**
     * Add custom validation rule
     */
    addRule(rule: ValidationRule): void {
        this.customRules.push(rule);
    }

    /**
     * Get nested object value
     */
    private getNestedValue(obj: any, path: string): any {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }

    /**
     * Set nested object value
     */
    private setNestedValue(obj: any, path: string, value: any): void {
        const keys = path.split('.');
        const lastKey = keys.pop()!;
        const target = keys.reduce((current, key) => {
            if (!(key in current)) {
                current[key] = {};
            }
            return current[key];
        }, obj);
        target[lastKey] = value;
    }
}

/**
 * Configuration Validator
 * Validates application configuration at startup
 */

import { BaseAppConfig } from './ServiceRegistry';
import { Logger } from '../utils/logger';

export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

export interface ValidationRule<T = any> {
    path: string;
    required?: boolean;
    type?: 'string' | 'number' | 'boolean' | 'object' | 'array';
    validate?: (value: T) => boolean | string;
    default?: T;
    description?: string;
}

export class ConfigValidator {
    private rules: ValidationRule[] = [];
    private logger?: Logger;

    constructor(logger?: Logger) {
        this.logger = logger;
        this.setupDefaultRules();
    }

    /**
     * Add validation rule
     */
    addRule(rule: ValidationRule): void {
        this.rules.push(rule);
    }

    /**
     * Setup default validation rules for BaseAppConfig
     */
    private setupDefaultRules(): void {
        // Basic required fields
        this.addRule({
            path: 'port',
            required: true,
            type: 'number',
            validate: (value: number) => value > 0 && value <= 65535,
            description: 'Server port number (1-65535)'
        });

        this.addRule({
            path: 'jwtSecret',
            required: true,
            type: 'string',
            validate: (value: string) => value.length >= 32 || 'JWT secret must be at least 32 characters',
            description: 'JWT secret key (minimum 32 characters)'
        });

        this.addRule({
            path: 'jwtExpiresIn',
            required: true,
            type: 'string',
            validate: (value: string) => /^\d+[hdms]$/.test(value) || 'Invalid time format (use: 1h, 30m, 24h, etc.)',
            description: 'JWT expiration time (e.g., "1h", "30m", "24h")'
        });

        // Database configuration
        this.addRule({
            path: 'database.type',
            required: true,
            type: 'string',
            validate: (value: string) => ['sqlite', 'mysql'].includes(value),
            description: 'Database type (sqlite or mysql)'
        });

        // SQLite specific
        this.addRule({
            path: 'database.sqlite.file',
            required: false, // Only required if type is sqlite
            type: 'string',
            validate: (value: string) => value.endsWith('.sqlite') || value.endsWith('.db'),
            description: 'SQLite database file path'
        });

        // MySQL specific
        this.addRule({
            path: 'database.mysql.host',
            required: false, // Only required if type is mysql
            type: 'string',
            description: 'MySQL host'
        });

        this.addRule({
            path: 'database.mysql.port',
            required: false,
            type: 'number',
            validate: (value: number) => value > 0 && value <= 65535,
            description: 'MySQL port number'
        });

        this.addRule({
            path: 'database.mysql.user',
            required: false,
            type: 'string',
            description: 'MySQL username'
        });

        this.addRule({
            path: 'database.mysql.password',
            required: false,
            type: 'string',
            description: 'MySQL password'
        });

        this.addRule({
            path: 'database.mysql.database',
            required: false,
            type: 'string',
            description: 'MySQL database name'
        });
    }

    /**
     * Validate configuration
     */
    validate(config: BaseAppConfig): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        this.logger?.debug('Validating configuration...', { rules: this.rules.length });

        for (const rule of this.rules) {
            try {
                const value = this.getNestedValue(config, rule.path);
                
                // Check if required
                if (rule.required && (value === undefined || value === null)) {
                    // Special case for database-specific rules
                    if (this.isDatabaseSpecificRule(rule, config)) {
                        continue;
                    }
                    errors.push(`Missing required field: ${rule.path}${rule.description ? ` (${rule.description})` : ''}`);
                    continue;
                }

                // Skip validation if value is undefined and not required
                if (value === undefined || value === null) {
                    continue;
                }

                // Type validation
                if (rule.type && !this.validateType(value, rule.type)) {
                    errors.push(`Invalid type for ${rule.path}: expected ${rule.type}, got ${typeof value}`);
                    continue;
                }

                // Custom validation
                if (rule.validate) {
                    const result = rule.validate(value);
                    if (result === false) {
                        errors.push(`Validation failed for ${rule.path}`);
                    } else if (typeof result === 'string') {
                        errors.push(`${rule.path}: ${result}`);
                    }
                }
            } catch (error) {
                errors.push(`Error validating ${rule.path}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }

        // Add warnings for common issues
        this.addCommonWarnings(config, warnings);

        const valid = errors.length === 0;

        this.logger?.debug('Configuration validation completed', {
            valid,
            errors: errors.length,
            warnings: warnings.length
        });

        if (!valid && this.logger) {
            this.logger.error('Configuration validation failed:', errors);
        }

        if (warnings.length > 0 && this.logger) {
            this.logger.warn('Configuration warnings:', warnings);
        }

        return { valid, errors, warnings };
    }

    /**
     * Validate and apply defaults
     */
    validateAndApplyDefaults(config: BaseAppConfig): { config: BaseAppConfig; validation: ValidationResult } {
        // Apply defaults first
        const configWithDefaults = this.applyDefaults(config);
        
        // Then validate
        const validation = this.validate(configWithDefaults);
        
        return { config: configWithDefaults, validation };
    }

    /**
     * Apply default values
     */
    private applyDefaults(config: BaseAppConfig): BaseAppConfig {
        const result = { ...config };
        
        for (const rule of this.rules) {
            if (rule.default !== undefined && this.getNestedValue(result, rule.path) === undefined) {
                this.setNestedValue(result, rule.path, rule.default);
            }
        }
        
        return result;
    }

    /**
     * Check if rule is database-specific and should be skipped
     */
    private isDatabaseSpecificRule(rule: ValidationRule, config: BaseAppConfig): boolean {
        if (rule.path.startsWith('database.sqlite.') && config.database.type !== 'sqlite') {
            return true;
        }
        if (rule.path.startsWith('database.mysql.') && config.database.type !== 'mysql') {
            return true;
        }
        return false;
    }

    /**
     * Add common configuration warnings
     */
    private addCommonWarnings(config: BaseAppConfig, warnings: string[]): void {
        // Environment-specific warnings
        const isProduction = process.env.NODE_ENV === 'production';
        
        if (isProduction) {
            if (config.jwtSecret.length < 64) {
                warnings.push('JWT secret should be at least 64 characters in production');
            }
            
            if (config.database.type === 'sqlite') {
                warnings.push('SQLite is not recommended for production use');
            }
        }

        // Security warnings
        if (config.jwtSecret === 'your-secret-key' || config.jwtSecret === 'default-secret') {
            warnings.push('Using default JWT secret - change this for security');
        }

        // Performance warnings
        if (config.database.type === 'mysql' && config.database.mysql?.connectionLimit && config.database.mysql.connectionLimit < 5) {
            warnings.push('MySQL connection limit is very low, consider increasing for better performance');
        }
    }

    /**
     * Get nested object value by path
     */
    private getNestedValue(obj: any, path: string): any {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }

    /**
     * Set nested object value by path
     */
    private setNestedValue(obj: any, path: string, value: any): void {
        const keys = path.split('.');
        const lastKey = keys.pop()!;
        const target = keys.reduce((current, key) => {
            if (!current[key]) current[key] = {};
            return current[key];
        }, obj);
        target[lastKey] = value;
    }

    /**
     * Validate value type
     */
    private validateType(value: any, expectedType: string): boolean {
        switch (expectedType) {
            case 'string':
                return typeof value === 'string';
            case 'number':
                return typeof value === 'number' && !isNaN(value);
            case 'boolean':
                return typeof value === 'boolean';
            case 'object':
                return typeof value === 'object' && value !== null && !Array.isArray(value);
            case 'array':
                return Array.isArray(value);
            default:
                return true;
        }
    }

    /**
     * Create detailed validation report
     */
    createReport(validation: ValidationResult): string {
        const lines: string[] = [];
        
        lines.push('📋 Configuration Validation Report');
        lines.push('═'.repeat(40));
        
        if (validation.valid) {
            lines.push('✅ Configuration is valid');
        } else {
            lines.push('❌ Configuration validation failed');
        }
        
        if (validation.errors.length > 0) {
            lines.push('');
            lines.push('🚨 Errors:');
            validation.errors.forEach((error, i) => {
                lines.push(`  ${i + 1}. ${error}`);
            });
        }
        
        if (validation.warnings.length > 0) {
            lines.push('');
            lines.push('⚠️  Warnings:');
            validation.warnings.forEach((warning, i) => {
                lines.push(`  ${i + 1}. ${warning}`);
            });
        }
        
        return lines.join('\n');
    }
}

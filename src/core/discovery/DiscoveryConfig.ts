/**
 * DiscoveryConfig - Centralized configuration for component discovery
 * Single responsibility: Configuration management and pattern definitions
 */

import { ScanPattern } from './FileScanner';

export interface ComponentPatterns {
    handlers: string[];
    services: string[];
    repositories: string[];
    middleware: string[];
    controllers: string[];
    components: string[];
}

export interface DiscoveryConfiguration {
    /** Base directory for discovery */
    baseDirectory: string;
    /** Component type patterns */
    patterns: ComponentPatterns;
    /** Global exclude patterns */
    globalExcludes: string[];
    /** File extensions to scan */
    extensions: string[];
    /** Maximum scan depth */
    maxDepth: number;
    /** Async scan options */
    async: {
        enabled: boolean;
        batchSize: number;
        progressReporting: boolean;
    };
    /** Performance options */
    performance: {
        cachePatterns: boolean;
        parallelScanning: boolean;
        maxConcurrency: number;
    };
}

/**
 * Configuration builder and manager for component discovery
 */
export class DiscoveryConfig {
    private static readonly DEFAULT_CONFIG: DiscoveryConfiguration = {
        baseDirectory: process.cwd(),
        patterns: {
            handlers: [
                '**/handlers/**/*.ts',
                '**/*Handler.ts',
                '**/controllers/**/*.ts',
                '**/*Controller.ts'
            ],
            services: [
                '**/services/**/*.ts',
                '**/*Service.ts'
            ],
            repositories: [
                '**/repositories/**/*.ts',
                '**/*Repository.ts',
                '**/data/**/*.ts',
                '**/dao/**/*.ts'
            ],
            middleware: [
                '**/middleware/**/*.ts',
                '**/*Middleware.ts'
            ],
            controllers: [
                '**/controllers/**/*.ts',
                '**/*Controller.ts',
                '**/handlers/**/*.ts',
                '**/*Handler.ts'
            ],
            components: [
                '**/components/**/*.ts',
                '**/*Component.ts'
            ]
        },
        globalExcludes: [
            '**/*.test.ts',
            '**/*.spec.ts',
            '**/*.d.ts',
            '**/node_modules/**',
            '**/dist/**',
            '**/build/**',
            '**/coverage/**',
            '**/.git/**',
            '**/tmp/**',
            '**/temp/**'
        ],
        extensions: ['.ts'],
        maxDepth: 10,
        async: {
            enabled: true,
            batchSize: 50,
            progressReporting: false
        },
        performance: {
            cachePatterns: true,
            parallelScanning: true,
            maxConcurrency: 4
        }
    };

    /**
     * Create default configuration
     */
    static createDefault(): DiscoveryConfiguration {
        return JSON.parse(JSON.stringify(this.DEFAULT_CONFIG));
    }

    /**
     * Create configuration for specific environment
     */
    static createForEnvironment(env: 'development' | 'production' | 'test'): DiscoveryConfiguration {
        const config = this.createDefault();

        switch (env) {
            case 'development':
                config.async.progressReporting = true;
                config.performance.maxConcurrency = 2; // Lower for dev
                break;

            case 'production':
                config.async.batchSize = 100; // Larger batches in prod
                config.performance.maxConcurrency = 8; // Higher for prod
                config.performance.cachePatterns = true;
                break;

            case 'test':
                config.async.enabled = false; // Sync for tests
                config.maxDepth = 5; // Limited depth for tests
                config.performance.cachePatterns = false; // No cache in tests
                break;
        }

        return config;
    }

    /**
     * Create configuration from partial options
     */
    static create(overrides: Partial<DiscoveryConfiguration>): DiscoveryConfiguration {
        const config = this.createDefault();
        return this.deepMerge(config, overrides);
    }

    /**
     * Create scan pattern for specific component types
     */
    static createScanPattern(
        componentTypes: (keyof ComponentPatterns)[],
        config: DiscoveryConfiguration
    ): ScanPattern {
        const includePatterns = componentTypes.flatMap(type => config.patterns[type]);

        return {
            include: includePatterns,
            exclude: config.globalExcludes,
            extensions: config.extensions,
            maxDepth: config.maxDepth,
            followSymlinks: false
        };
    }

    /**
     * Get patterns for all component types
     */
    static getAllPatterns(config: DiscoveryConfiguration): ScanPattern {
        const allTypes: (keyof ComponentPatterns)[] = [
            'handlers',
            'services',
            'repositories',
            'middleware',
            'controllers',
            'components'
        ];

        return this.createScanPattern(allTypes, config);
    }

    /**
     * Validate configuration
     */
    static validate(config: DiscoveryConfiguration): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        // Validate base directory
        if (!config.baseDirectory || typeof config.baseDirectory !== 'string') {
            errors.push('baseDirectory must be a non-empty string');
        }

        // Validate patterns
        if (!config.patterns || typeof config.patterns !== 'object') {
            errors.push('patterns must be an object');
        } else {
            for (const [type, patterns] of Object.entries(config.patterns)) {
                if (!Array.isArray(patterns)) {
                    errors.push(`patterns.${type} must be an array`);
                }
            }
        }

        // Validate extensions
        if (!Array.isArray(config.extensions) || config.extensions.length === 0) {
            errors.push('extensions must be a non-empty array');
        }

        // Validate max depth
        if (typeof config.maxDepth !== 'number' || config.maxDepth < 1) {
            errors.push('maxDepth must be a positive number');
        }

        // Validate async config
        if (!config.async || typeof config.async !== 'object') {
            errors.push('async configuration must be an object');
        } else {
            if (typeof config.async.batchSize !== 'number' || config.async.batchSize < 1) {
                errors.push('async.batchSize must be a positive number');
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Get configuration for specific use cases
     */
    static presets = {
        /**
         * Minimal configuration for small projects
         */
        minimal(): DiscoveryConfiguration {
            const config = DiscoveryConfig.createDefault();
            config.maxDepth = 5;
            config.async.enabled = false;
            config.patterns = {
                handlers: ['**/handlers/**/*.ts', '**/*Handler.ts'],
                services: ['**/services/**/*.ts', '**/*Service.ts'],
                repositories: ['**/repositories/**/*.ts', '**/*Repository.ts'],
                middleware: ['**/middleware/**/*.ts'],
                controllers: ['**/controllers/**/*.ts'],
                components: ['**/components/**/*.ts']
            };
            return config;
        },

        /**
         * High-performance configuration for large projects
         */
        performance(): DiscoveryConfiguration {
            const config = DiscoveryConfig.createDefault();
            config.async.enabled = true;
            config.async.batchSize = 200;
            config.performance.maxConcurrency = 8;
            config.performance.parallelScanning = true;
            config.performance.cachePatterns = true;
            return config;
        },

        /**
         * Testing configuration
         */
        testing(): DiscoveryConfiguration {
            return DiscoveryConfig.createForEnvironment('test');
        }
    };

    /**
     * Deep merge utility for configuration
     */
    private static deepMerge<T>(target: T, source: Partial<T>): T {
        const result = { ...target };

        for (const key in source) {
            if (source[key] !== undefined) {
                if (typeof source[key] === 'object' && !Array.isArray(source[key])) {
                    result[key] = this.deepMerge(result[key] as any, source[key] as any);
                } else {
                    result[key] = source[key] as any;
                }
            }
        }

        return result;
    }

    /**
     * Export configuration to JSON
     */
    static toJSON(config: DiscoveryConfiguration): string {
        return JSON.stringify(config, null, 2);
    }

    /**
     * Import configuration from JSON
     */
    static fromJSON(json: string): DiscoveryConfiguration {
        try {
            const parsed = JSON.parse(json);
            return this.create(parsed);
        } catch (error) {
            throw new Error(`Invalid configuration JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}

/**
 * ModernAutoDiscovery - Refactored auto-discovery system
 * Single responsibility: Component discovery orchestration
 * Uses the new modular discovery system
 */

import { AsyncComponentDiscovery, DiscoveredComponent, DiscoveryResult, DiscoveryProgress } from './discovery/AsyncComponentDiscovery';
import { DiscoveryConfig, DiscoveryConfiguration, ComponentPatterns } from './discovery/DiscoveryConfig';
import { ComponentRegistry, RegistrationResult, RegistrationOptions } from './discovery/ComponentRegistry';
import { Container } from './container/Container';
import { Logger } from '../utils/logger';

export interface AutoDiscoveryOptions {
    /** Discovery configuration */
    config?: Partial<DiscoveryConfiguration>;
    /** Component types to discover */
    componentTypes?: (keyof ComponentPatterns)[];
    /** Registration options */
    registrationOptions?: RegistrationOptions;
    /** Progress reporting callback */
    onProgress?: (progress: DiscoveryProgress) => void;
    /** Enable detailed logging */
    verbose?: boolean;
}

export interface AutoDiscoveryResult {
    discovery: DiscoveryResult;
    registration: RegistrationResult;
    summary: {
        totalTime: number;
        discoveredComponents: number;
        registeredComponents: number;
        successRate: number;
    };
}

/**
 * Modern auto-discovery system with improved architecture
 * Separates concerns and provides async support with progress reporting
 */
export class AutoDiscovery {
    private discovery: AsyncComponentDiscovery;
    private registry: ComponentRegistry;
    private logger?: Logger;

    constructor(logger?: Logger) {
        this.logger = logger;
        this.discovery = new AsyncComponentDiscovery(logger);
        this.registry = new ComponentRegistry(logger);
    }

    /**
     * Discover and register components automatically
     */
    async discoverAndRegister(
        container: Container,
        options: AutoDiscoveryOptions = {}
    ): Promise<AutoDiscoveryResult> {
        const startTime = Date.now();
        
        try {
            this.logger?.info('🚀 Starting modern auto-discovery...');

            // Create configuration
            const config = this.createConfiguration(options);
            
            // Validate configuration
            const validation = DiscoveryConfig.validate(config);
            if (!validation.valid) {
                throw new Error(`Invalid discovery configuration: ${validation.errors.join(', ')}`);
            }

            // Discover components
            const discoveryResult = await this.performDiscovery(config, options);
            
            // Register components
            const registrationResult = await this.performRegistration(
                discoveryResult.components,
                container,
                options
            );

            // Calculate summary
            const totalTime = Date.now() - startTime;
            const summary = {
                totalTime,
                discoveredComponents: discoveryResult.components.length,
                registeredComponents: registrationResult.successful,
                successRate: discoveryResult.components.length > 0 ? 
                    (registrationResult.successful / discoveryResult.components.length) * 100 : 100
            };

            this.logger?.info(`✅ Auto-discovery completed in ${totalTime}ms`, summary);

            return {
                discovery: discoveryResult,
                registration: registrationResult,
                summary
            };

        } catch (error) {
            this.logger?.error('❌ Auto-discovery failed:', error);
            throw error;
        }
    }

    /**
     * Discover components only (without registration)
     */
    async discoverOnly(options: AutoDiscoveryOptions = {}): Promise<DiscoveryResult> {
        const config = this.createConfiguration(options);
        return this.performDiscovery(config, options);
    }

    /**
     * Register pre-discovered components
     */
    async registerOnly(
        components: DiscoveredComponent[],
        container: Container,
        options: RegistrationOptions = {
            continueOnError: true,
            skipDuplicates: true
        }
    ): Promise<RegistrationResult> {
        return this.registry.registerComponents(components, container, options);
    }

    /**
     * Get discovery statistics and recommendations
     */
    async getDiscoveryStats(options: AutoDiscoveryOptions = {}): Promise<{
        estimatedFiles: number;
        estimatedComponents: number;
        configurationValid: boolean;
        recommendedSettings: Partial<DiscoveryConfiguration>;
        performanceProfile: 'small' | 'medium' | 'large' | 'enterprise';
    }> {
        const config = this.createConfiguration(options);
        const stats = await this.discovery.getDiscoveryStats(config);
        
        // Determine performance profile
        let performanceProfile: 'small' | 'medium' | 'large' | 'enterprise';
        if (stats.estimatedFiles < 50) {
            performanceProfile = 'small';
        } else if (stats.estimatedFiles < 200) {
            performanceProfile = 'medium';
        } else if (stats.estimatedFiles < 1000) {
            performanceProfile = 'large';
        } else {
            performanceProfile = 'enterprise';
        }

        return {
            ...stats,
            performanceProfile
        };
    }

    /**
     * Create optimized configuration based on project characteristics
     */
    async createOptimizedConfig(baseDir: string): Promise<DiscoveryConfiguration> {
        const tempConfig = DiscoveryConfig.create({ baseDirectory: baseDir });
        const stats = await this.discovery.getDiscoveryStats(tempConfig);
        
        if (stats.estimatedFiles > 1000) {
            // Large project optimizations
            return DiscoveryConfig.presets.performance();
        } else if (stats.estimatedFiles < 50) {
            // Small project optimizations
            return DiscoveryConfig.presets.minimal();
        } else {
            // Default configuration for medium projects
            return DiscoveryConfig.createForEnvironment(
                process.env.NODE_ENV as 'development' | 'production' | 'test' || 'development'
            );
        }
    }

    /**
     * Perform component discovery
     */
    private async performDiscovery(
        config: DiscoveryConfiguration,
        options: AutoDiscoveryOptions
    ): Promise<DiscoveryResult> {
        if (options.componentTypes && options.componentTypes.length > 0) {
            // Discover specific component types
            return this.discovery.discoverComponentTypes(
                options.componentTypes,
                config,
                options.onProgress
            );
        } else {
            // Discover all component types
            return this.discovery.discoverComponents(config, options.onProgress);
        }
    }

    /**
     * Perform component registration
     */
    private async performRegistration(
        components: DiscoveredComponent[],
        container: Container,
        options: AutoDiscoveryOptions
    ): Promise<RegistrationResult> {
        const registrationOptions = options.registrationOptions || this.getDefaultRegistrationOptions();
        return this.registry.registerComponents(components, container, registrationOptions);
    }

    /**
     * Create discovery configuration
     */
    private createConfiguration(options: AutoDiscoveryOptions): DiscoveryConfiguration {
        if (options.config) {
            return DiscoveryConfig.create(options.config);
        }

        // Auto-detect environment and create appropriate config
        const env = process.env.NODE_ENV as 'development' | 'production' | 'test' || 'development';
        return DiscoveryConfig.createForEnvironment(env);
    }

    /**
     * Get default registration options
     */
    private getDefaultRegistrationOptions(): RegistrationOptions {
        return {
            continueOnError: true,
            skipDuplicates: true,
            filters: [
                // Skip test files
                (component) => !component.relativePath.includes('.test.') && 
                              !component.relativePath.includes('.spec.'),
                
                // Skip declaration files
                (component) => !component.relativePath.endsWith('.d.ts')
            ],
            preRegistrationHooks: this.logger ? [
                async (component, metadata) => {
                    this.logger?.debug(`Pre-registering: ${String(metadata.identifier)} (${metadata.type})`);
                }
            ] : undefined
        };
    }

    /**
     * Get registry statistics
     */
    getRegistryStats() {
        return this.registry.getRegistrationStats();
    }

    /**
     * Clear all registrations (useful for testing)
     */
    clearRegistrations(): void {
        this.registry.clearRegistrations();
    }
}

/**
 * Convenience function for simple auto-discovery
 */
export async function quickAutoDiscovery(
    container: Container,
    baseDirectory?: string,
    logger?: Logger
): Promise<AutoDiscoveryResult> {
    const autoDiscovery = new AutoDiscovery(logger);
    
    const options: AutoDiscoveryOptions = {
        config: baseDirectory ? { baseDirectory } : undefined,
        verbose: process.env.NODE_ENV === 'development'
    };

    return autoDiscovery.discoverAndRegister(container, options);
}

/**
 * Factory function for different discovery profiles
 */
export function createAutoDiscovery(profile: 'minimal' | 'standard' | 'performance', logger?: Logger): AutoDiscovery {
    const autoDiscovery = new AutoDiscovery(logger);
    
    // Configure based on profile
    switch (profile) {
        case 'minimal':
            // Already optimized for small projects
            break;
        case 'standard':
            // Default configuration
            break;
        case 'performance':
            // Will use performance presets
            break;
    }
    
    return autoDiscovery;
}

import { DatabaseProvider } from '../interfaces/DatabaseProvider';
import { CrudRepository } from './CrudRepository';
import { ErrorHandler } from '../../utils/errorHandler';

/**
 * Base interface for repository map configurations
 * Applications should extend this interface with their specific repository types
 */
export interface BaseRepositoryMap {
    [key: string]: any;
}

/**
 * Repository configuration for factory instantiation
 */
export interface RepositoryConfig {
    repositoryClass?: new (provider: DatabaseProvider, errorHandler: ErrorHandler) => any;
    tableName: string;
    primaryKey?: string;
    customOptions?: any;
}

/**
 * Generic Repository Factory using Factory Pattern
 * Creates and manages repository instances based on configuration
 */
export class RepositoryFactory<TRepositoryMap extends BaseRepositoryMap = BaseRepositoryMap> {
    private static instances = new Map<string, any>();
    private provider: DatabaseProvider;
    private errorHandler: ErrorHandler;
    private repositoryConfigs: Record<keyof TRepositoryMap, RepositoryConfig>;

    constructor(
        provider: DatabaseProvider, 
        repositoryConfigs: Record<keyof TRepositoryMap, RepositoryConfig>,
        errorHandler: ErrorHandler
    ) {
        this.provider = provider;
        this.repositoryConfigs = repositoryConfigs;
        this.errorHandler = errorHandler;
    }

    /**
     * Get or create a repository instance (Singleton pattern per type)
     */
    getRepository<K extends keyof TRepositoryMap>(type: K): TRepositoryMap[K] {
        const key = `${String(type)}_${this.provider.constructor.name}`;
        
        if (!RepositoryFactory.instances.has(key)) {
            RepositoryFactory.instances.set(key, this.createRepository(type));
        }

        return RepositoryFactory.instances.get(key) as TRepositoryMap[K];
    }

    /**
     * Create a new repository instance based on type and configuration
     */
    private createRepository<K extends keyof TRepositoryMap>(type: K): TRepositoryMap[K] {
        const config = this.repositoryConfigs[type];
        
        if (!config) {
            throw new Error(`No configuration found for repository type: ${String(type)}`);
        }

        // If a custom repository class is provided, use it
        if (config.repositoryClass) {
            return new config.repositoryClass(this.provider, this.errorHandler) as TRepositoryMap[K];
        }

        // Otherwise, create a generic CrudRepository
        return new CrudRepository<any>(this.provider, {
            tableName: config.tableName,
            primaryKey: config.primaryKey || 'id',
            ...config.customOptions
        }, this.errorHandler) as TRepositoryMap[K];
    }

    /**
     * Clear all cached instances (useful for testing)
     */
    static clearCache(): void {
        RepositoryFactory.instances.clear();
    }

    /**
     * Check if a repository type is supported
     */
    isSupported<K extends keyof TRepositoryMap>(type: K): boolean {
        return type in this.repositoryConfigs;
    }

    /**
     * Get list of all supported repository types
     */
    getSupportedTypes(): (keyof TRepositoryMap)[] {
        return Object.keys(this.repositoryConfigs) as (keyof TRepositoryMap)[];
    }
}

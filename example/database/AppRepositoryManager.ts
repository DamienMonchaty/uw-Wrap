import { DatabaseProvider } from '../../src/database/interfaces/DatabaseProvider';
import { Logger } from '../../src/utils/logger';
import { ErrorHandler } from '../../src/utils/errorHandler';
import { 
    RepositoryFactory as GenericRepositoryFactory, 
    type BaseRepositoryMap, 
    type RepositoryConfig as GenericRepositoryConfig 
} from '../../src/database/repositories/GenericRepositoryFactory';
import { UserRepository } from './repositories/UserRepository';

/**
 * Application-specific repository map
 */
export interface AppRepositoryMap extends BaseRepositoryMap {
    users: UserRepository;
    posts: any; // You can create a PostRepository later
}

/**
 * Application-specific repository configurations
 */
const APP_REPOSITORY_CONFIGS: Record<keyof AppRepositoryMap, GenericRepositoryConfig> = {
    users: {
        repositoryClass: UserRepository,
        tableName: 'users',
        primaryKey: 'id'
    }
};

/**
 * Application-specific repository manager using the generic factory from the wrapper
 * Provides clean, typed access to specialized repositories
 */
export class AppRepositoryManager {
    private repositoryFactory: GenericRepositoryFactory<AppRepositoryMap>;
    private logger: Logger;

    constructor(provider: DatabaseProvider, logger: Logger, errorHandler: ErrorHandler) {
        this.repositoryFactory = new GenericRepositoryFactory<AppRepositoryMap>(
            provider, 
            APP_REPOSITORY_CONFIGS,
            errorHandler
        );
        this.logger = logger;
    }

    /**
     * Get User Repository with all specialized methods
     */
    get users(): UserRepository {
        this.logger.debug('Accessing UserRepository');
        return this.repositoryFactory.getRepository('users');
    }

    /**
     * Generic method to get any repository by type
     */
    getRepository<K extends keyof AppRepositoryMap>(type: K): AppRepositoryMap[K] {
        this.logger.debug(`Accessing ${String(type)} repository`);
        return this.repositoryFactory.getRepository(type);
    }

    /**
     * Check if a repository type is supported
     */
    isRepositorySupported<K extends keyof AppRepositoryMap>(type: K): boolean {
        return this.repositoryFactory.isSupported(type);
    }

    /**
     * Get list of all supported repository types
     */
    getSupportedRepositoryTypes(): (keyof AppRepositoryMap)[] {
        return this.repositoryFactory.getSupportedTypes();
    }

    /**
     * Clear repository cache (useful for testing)
     */
    clearCache(): void {
        GenericRepositoryFactory.clearCache();
        this.logger.info('Repository cache cleared');
    }
}

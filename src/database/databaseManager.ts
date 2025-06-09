import fs from 'fs';
import { DatabaseRecord } from '../types';
import { ErrorHandler } from '../utils/errorHandler';
import { Logger } from '../utils/logger';
import { DatabaseProvider } from './interfaces/DatabaseProvider';

/**
 * Legacy Database Manager - Deprecated in favor of IoC architecture
 * @deprecated Use Container and ServiceRegistry instead for new projects
 */
export class DatabaseManager {
    private provider: DatabaseProvider;
    private errorHandler: ErrorHandler;
    private logger: Logger;

    constructor(
        provider: DatabaseProvider, 
        logger: Logger, 
        errorHandler: ErrorHandler
    ) {
        this.provider = provider;
        this.logger = logger;
        this.errorHandler = errorHandler;
    }

    async initialize(): Promise<void> {
        try {
            await this.provider.connect();
            this.logger.info('Database connected successfully');
        } catch (error) {
            this.logger.error('Failed to connect to database', { error });
            throw this.errorHandler.createDatabaseError('Failed to connect to database');
        }
    }

    async initializeSchema(schemaFile: string): Promise<void> {
        try {
            const schema = fs.readFileSync(schemaFile, 'utf-8');
            // Split schema into individual statements and execute them
            const statements = schema.split(';').filter(stmt => stmt.trim().length > 0);
            
            for (const statement of statements) {
                await this.provider.execute(statement.trim());
            }
            
            this.logger.info('Database schema initialized', { schemaFile });
        } catch (error) {
            this.logger.error('Failed to initialize schema', { error, schemaFile });
            throw this.errorHandler.createDatabaseError('Failed to initialize schema');
        }
    }

    async beginTransaction(): Promise<void> {
        try {
            await this.provider.beginTransaction();
            this.logger.debug('Transaction started');
        } catch (error) {
            this.logger.error('Failed to begin transaction', { error });
            throw this.errorHandler.createDatabaseError('Failed to begin transaction');
        }
    }

    async commitTransaction(): Promise<void> {
        try {
            await this.provider.commitTransaction();
            this.logger.debug('Transaction committed');
        } catch (error) {
            this.logger.error('Failed to commit transaction', { error });
            throw this.errorHandler.createDatabaseError('Failed to commit transaction');
        }
    }

    async rollbackTransaction(): Promise<void> {
        try {
            await this.provider.rollbackTransaction();
            this.logger.debug('Transaction rolled back');
        } catch (error) {
            this.logger.error('Failed to rollback transaction', { error });
            throw this.errorHandler.createDatabaseError('Failed to rollback transaction');
        }
    }

    async close(): Promise<void> {
        try {
            await this.provider.disconnect();
            this.logger.info('Database connection closed');
        } catch (error) {
            this.logger.error('Error closing database', { error });
            throw this.errorHandler.createDatabaseError('Error closing database');
        }
    }

    /**
     * Direct database operations (use with caution)
     * For type-safe operations, use the IoC container with repositories
     */
    async query<T = DatabaseRecord>(sql: string, params?: any[]): Promise<T[]> {
        try {
            const result = await this.provider.query(sql, params);
            return result as T[];
        } catch (error) {
            this.logger.error('Query failed', { error, sql, params });
            throw this.errorHandler.createDatabaseError('Query execution failed');
        }
    }

    async execute(sql: string, params?: any[]): Promise<any> {
        try {
            return await this.provider.execute(sql, params);
        } catch (error) {
            this.logger.error('Execute failed', { error, sql, params });
            throw this.errorHandler.createDatabaseError('Statement execution failed');
        }
    }
}

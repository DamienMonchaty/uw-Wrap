import { DatabaseProvider } from '../interfaces/DatabaseProvider';
import { DatabaseRecord } from '../../types';
import { ErrorHandler } from '../../utils/errorHandler';

export interface RepositoryOptions {
    tableName: string;
    primaryKey?: string;
}

export interface PaginationOptions {
    page?: number;
    limit?: number;
    orderBy?: string;
    orderDirection?: 'ASC' | 'DESC';
}

export interface PaginationResult<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
}

export interface QueryOptions {
    where?: DatabaseRecord;
    pagination?: PaginationOptions;
    select?: string[];
}

export class CrudRepository<TModel extends DatabaseRecord> {
    protected provider: DatabaseProvider;
    protected tableName: string;
    protected primaryKey: string;
    protected errorHandler: ErrorHandler;

    constructor(provider: DatabaseProvider, options: RepositoryOptions, errorHandler: ErrorHandler) {
        this.provider = provider;
        this.tableName = options.tableName;
        this.primaryKey = options.primaryKey || 'id';
        this.errorHandler = errorHandler;
    }

    /**
     * Create a new record
     */
    async create(data: Partial<TModel>): Promise<TModel> {
        try {
            const insertId = await this.provider.create(this.tableName, data as DatabaseRecord);
            const created = await this.findById(insertId);
            if (!created) {
                throw this.errorHandler.createDatabaseError(
                    `Failed to retrieve created record with ID: ${insertId}`,
                    'create',
                    this.tableName,
                    { insertId }
                );
            }
            return created;
        } catch (error) {
            if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
                throw this.errorHandler.createConflictError(
                    'Record with unique field already exists',
                    this.tableName
                );
            }
            throw this.errorHandler.createDatabaseError(
                `Failed to create record in ${this.tableName}`,
                'create',
                this.tableName,
                { originalError: error }
            );
        }
    }

    /**
     * Find all records with optional conditions
     */
    async findAll(options: QueryOptions = {}): Promise<TModel[]> {
        try {
            const results = await this.provider.read(this.tableName, options.where || {});
            return results as TModel[];
        } catch (error) {
            throw this.errorHandler.createDatabaseError(
                `Failed to find records in ${this.tableName}`,
                'findAll',
                this.tableName,
                { originalError: error }
            );
        }
    }

    /**
     * Find all records with pagination support
     */
    async findAllPaginated(options: QueryOptions = {}): Promise<PaginationResult<TModel>> {
        const { pagination = {}, where = {} } = options;
        const { page = 1, limit = 10, orderBy = this.primaryKey, orderDirection = 'ASC' } = pagination;
        
        // Calculate offset
        const offset = (page - 1) * limit;
        
        // Build base query for counting
        let countSql = `SELECT COUNT(*) as total FROM ${this.tableName}`;
        let values: any[] = [];
        
        if (Object.keys(where).length > 0) {
            const whereClause = Object.keys(where)
                .map(key => `${key} = ?`)
                .join(' AND ');
            countSql += ` WHERE ${whereClause}`;
            values = Object.values(where);
        }
        
        // Get total count
        const [countResult] = await this.provider.query(countSql, values);
        const total = (countResult as any).total;
        
        // Build data query
        let dataSql = `SELECT * FROM ${this.tableName}`;
        if (Object.keys(where).length > 0) {
            const whereClause = Object.keys(where)
                .map(key => `${key} = ?`)
                .join(' AND ');
            dataSql += ` WHERE ${whereClause}`;
        }
        
        dataSql += ` ORDER BY ${orderBy} ${orderDirection} LIMIT ${limit} OFFSET ${offset}`;
        
        // Get paginated data
        const data = await this.provider.query(dataSql, values);
        
        // Calculate pagination metadata
        const totalPages = Math.ceil(total / limit);
        const hasNext = page < totalPages;
        const hasPrev = page > 1;
        
        return {
            data: data as TModel[],
            total,
            page,
            limit,
            totalPages,
            hasNext,
            hasPrev
        };
    }

    /**
     * Find a single record by ID
     */
    async findById(id: string | number): Promise<TModel | null> {
        try {
            const result = await this.provider.findById(this.tableName, id);
            return result as TModel | null;
        } catch (error) {
            throw this.errorHandler.createDatabaseError(
                `Failed to find record by ID ${id} in ${this.tableName}`,
                'findById',
                this.tableName,
                { id, originalError: error }
            );
        }
    }

    /**
     * Find records by a specific field
     */
    async findBy(field: string, value: any): Promise<TModel[]> {
        const results = await this.provider.findByField(this.tableName, field, value);
        return results as TModel[];
    }

    /**
     * Find a single record by a specific field
     */
    async findOneBy(field: string, value: any): Promise<TModel | null> {
        const results = await this.findBy(field, value);
        return results.length > 0 ? results[0] : null;
    }

    /**
     * Update a record by ID
     */
    async updateById(id: string | number, data: Partial<TModel>): Promise<TModel | null> {
        try {
            const conditions = { [this.primaryKey]: id };
            const affectedRows = await this.provider.update(this.tableName, data as DatabaseRecord, conditions);
            
            if (affectedRows === 0) {
                return null;
            }
            
            return this.findById(id);
        } catch (error) {
            if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
                throw this.errorHandler.createConflictError(
                    'Update would violate unique constraint',
                    this.tableName
                );
            }
            throw this.errorHandler.createDatabaseError(
                `Failed to update record with ID ${id} in ${this.tableName}`,
                'updateById',
                this.tableName,
                { id, originalError: error }
            );
        }
    }

    /**
     * Update records by conditions
     */
    async updateBy(conditions: Partial<TModel>, data: Partial<TModel>): Promise<number> {
        return this.provider.update(this.tableName, data as DatabaseRecord, conditions as DatabaseRecord);
    }

    /**
     * Delete a record by ID
     */
    async deleteById(id: string | number): Promise<boolean> {
        try {
            const conditions = { [this.primaryKey]: id };
            const affectedRows = await this.provider.delete(this.tableName, conditions);
            return affectedRows > 0;
        } catch (error) {
            throw this.errorHandler.createDatabaseError(
                `Failed to delete record with ID ${id} in ${this.tableName}`,
                'deleteById',
                this.tableName,
                { id, originalError: error }
            );
        }
    }

    /**
     * Delete records by conditions
     */
    async deleteBy(conditions: Partial<TModel>): Promise<number> {
        return this.provider.delete(this.tableName, conditions as DatabaseRecord);
    }

    /**
     * Check if a record exists by ID
     */
    async existsById(id: string | number): Promise<boolean> {
        const record = await this.findById(id);
        return record !== null;
    }

    /**
     * Check if a record exists by field
     */
    async existsBy(field: string, value: any): Promise<boolean> {
        const records = await this.findBy(field, value);
        return records.length > 0;
    }

    /**
     * Count all records with optional conditions
     */
    async count(conditions: Partial<TModel> = {}): Promise<number> {
        const results = await this.provider.read(this.tableName, conditions as DatabaseRecord);
        return results.length;
    }

    /**
     * Execute a transaction with multiple operations
     */
    async transaction<T>(operations: (repo: this) => Promise<T>): Promise<T> {
        await this.provider.beginTransaction();
        try {
            const result = await operations(this);
            await this.provider.commitTransaction();
            return result;
        } catch (error) {
            await this.provider.rollbackTransaction();
            throw error;
        }
    }

    /**
     * Get the underlying database provider
     */
    getProvider(): DatabaseProvider {
        return this.provider;
    }

    /**
     * Get the table name
     */
    getTableName(): string {
        return this.tableName;
    }

    /**
     * Get the primary key field name
     */
    getPrimaryKey(): string {
        return this.primaryKey;
    }
}

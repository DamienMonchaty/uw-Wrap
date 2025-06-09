import mysql from 'mysql2/promise';
import { DatabaseProvider, DatabaseResult } from '../interfaces/DatabaseProvider';
import { DatabaseRecord } from '../../types';
import { Logger } from '../../utils/logger';
import { ErrorHandler } from '../../utils/errorHandler';

export interface MySQLConfig {
    host: string;
    port?: number;
    user: string;
    password: string;
    database: string;
    charset?: string;
    timezone?: string;
    connectionLimit?: number;
}

export class MySQLProvider implements DatabaseProvider {
    private pool: mysql.Pool;
    private connection: mysql.PoolConnection | null = null;
    private logger: Logger;
    private errorHandler: ErrorHandler;

    constructor(config: MySQLConfig, logger: Logger, errorHandler: ErrorHandler) {
        this.logger = logger;
        this.errorHandler = errorHandler;
        
        this.pool = mysql.createPool({
            host: config.host,
            port: config.port || 3306,
            user: config.user,
            password: config.password,
            database: config.database,
            charset: config.charset || 'utf8mb4',
            timezone: config.timezone || '+00:00',
            connectionLimit: config.connectionLimit || 10,
            queueLimit: 0
        });

        this.logger.info('MySQL provider initialized', { 
            host: config.host, 
            port: config.port || 3306,
            database: config.database 
        });
    }

    async connect(): Promise<void> {
        try {
            const connection = await this.pool.getConnection();
            await connection.ping();
            connection.release();
            this.logger.info('MySQL connection established');
        } catch (error) {
            this.logger.error('Failed to connect to MySQL', { error });
            throw this.errorHandler.createDatabaseError('Failed to connect to MySQL database');
        }
    }

    async disconnect(): Promise<void> {
        try {
            if (this.connection) {
                this.connection.release();
                this.connection = null;
            }
            await this.pool.end();
            this.logger.info('MySQL connection closed');
        } catch (error) {
            this.logger.error('Error closing MySQL connection', { error });
            throw this.errorHandler.createDatabaseError('Failed to close MySQL connection');
        }
    }

    async query(sql: string, params: any[] = []): Promise<any[]> {
        try {
            const connection = this.connection || this.pool;
            const [rows] = await connection.execute(sql, params);
            this.logger.debug('MySQL query executed', { sql: sql.substring(0, 100) });
            return rows as any[];
        } catch (error) {
            this.logger.error('MySQL query failed', { sql, error });
            throw this.errorHandler.createDatabaseError('Query execution failed');
        }
    }

    async execute(sql: string, params: any[] = []): Promise<DatabaseResult> {
        try {
            const connection = this.connection || this.pool;
            const [result] = await connection.execute(sql, params) as any;
            
            this.logger.debug('MySQL execute completed', { 
                sql: sql.substring(0, 100),
                insertId: result.insertId,
                affectedRows: result.affectedRows 
            });
            
            return {
                insertId: result.insertId,
                affectedRows: result.affectedRows
            };
        } catch (error) {
            this.logger.error('MySQL execute failed', { sql, error });
            throw this.errorHandler.createDatabaseError('Execute operation failed');
        }
    }

    async initializeSchema(schema: string): Promise<void> {
        try {
            // Split schema into individual statements
            const statements = schema
                .split(';')
                .map(stmt => stmt.trim())
                .filter(stmt => stmt.length > 0);

            for (const statement of statements) {
                await this.execute(statement);
            }
            
            this.logger.info('MySQL schema initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize MySQL schema', { error });
            throw this.errorHandler.createDatabaseError('Failed to initialize database schema');
        }
    }

    async create(table: string, data: DatabaseRecord): Promise<number | string> {
        try {
            const keys = Object.keys(data);
            const values = Object.values(data);
            const placeholders = keys.map(() => '?').join(', ');
            
            const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
            const result = await this.execute(sql, values);
            
            this.logger.debug('MySQL CREATE executed', { table, insertId: result.insertId });
            return result.insertId || 0;
        } catch (error) {
            this.logger.error('MySQL CREATE failed', { table, error });
            throw this.errorHandler.createDatabaseError(`Failed to create record in ${table}`);
        }
    }

    async read(table: string, conditions: DatabaseRecord = {}): Promise<any[]> {
        try {
            let sql = `SELECT * FROM ${table}`;
            let values: any[] = [];

            if (Object.keys(conditions).length > 0) {
                const whereClause = Object.keys(conditions)
                    .map(key => `${key} = ?`)
                    .join(' AND ');
                sql += ` WHERE ${whereClause}`;
                values = Object.values(conditions);
            }

            const rows = await this.query(sql, values);
            
            this.logger.debug('MySQL READ executed', { table, count: rows.length });
            return rows;
        } catch (error) {
            this.logger.error('MySQL READ failed', { table, error });
            throw this.errorHandler.createDatabaseError(`Failed to read from ${table}`);
        }
    }

    async update(table: string, data: DatabaseRecord, conditions: DatabaseRecord): Promise<number> {
        try {
            const setClause = Object.keys(data)
                .map(key => `${key} = ?`)
                .join(', ');
            const whereClause = Object.keys(conditions)
                .map(key => `${key} = ?`)
                .join(' AND ');
            
            const sql = `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`;
            const values = [...Object.values(data), ...Object.values(conditions)];
            
            const result = await this.execute(sql, values);
            
            this.logger.debug('MySQL UPDATE executed', { table, affectedRows: result.affectedRows });
            return result.affectedRows || 0;
        } catch (error) {
            this.logger.error('MySQL UPDATE failed', { table, error });
            throw this.errorHandler.createDatabaseError(`Failed to update records in ${table}`);
        }
    }

    async delete(table: string, conditions: DatabaseRecord): Promise<number> {
        try {
            const whereClause = Object.keys(conditions)
                .map(key => `${key} = ?`)
                .join(' AND ');
            
            const sql = `DELETE FROM ${table} WHERE ${whereClause}`;
            const values = Object.values(conditions);
            
            const result = await this.execute(sql, values);
            
            this.logger.debug('MySQL DELETE executed', { table, affectedRows: result.affectedRows });
            return result.affectedRows || 0;
        } catch (error) {
            this.logger.error('MySQL DELETE failed', { table, error });
            throw this.errorHandler.createDatabaseError(`Failed to delete records from ${table}`);
        }
    }

    async findById(table: string, id: number | string): Promise<any | null> {
        const results = await this.read(table, { id });
        return results.length > 0 ? results[0] : null;
    }

    async findByField(table: string, field: string, value: any): Promise<any[]> {
        return this.read(table, { [field]: value });
    }

    async beginTransaction(): Promise<void> {
        try {
            if (this.connection) {
                throw new Error('Transaction already in progress');
            }
            this.connection = await this.pool.getConnection();
            await this.connection.beginTransaction();
            this.logger.debug('MySQL transaction started');
        } catch (error) {
            this.logger.error('Failed to begin MySQL transaction', { error });
            throw this.errorHandler.createDatabaseError('Failed to begin transaction');
        }
    }

    async commitTransaction(): Promise<void> {
        try {
            if (!this.connection) {
                throw new Error('No transaction in progress');
            }
            await this.connection.commit();
            this.connection.release();
            this.connection = null;
            this.logger.debug('MySQL transaction committed');
        } catch (error) {
            this.logger.error('Failed to commit MySQL transaction', { error });
            throw this.errorHandler.createDatabaseError('Failed to commit transaction');
        }
    }

    async rollbackTransaction(): Promise<void> {
        try {
            if (!this.connection) {
                throw new Error('No transaction in progress');
            }
            await this.connection.rollback();
            this.connection.release();
            this.connection = null;
            this.logger.debug('MySQL transaction rolled back');
        } catch (error) {
            this.logger.error('Failed to rollback MySQL transaction', { error });
            throw this.errorHandler.createDatabaseError('Failed to rollback transaction');
        }
    }
}

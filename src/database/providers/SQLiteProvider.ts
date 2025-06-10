import sqlite3 from 'sqlite3';
import fs from 'fs';
import { DatabaseProvider, DatabaseResult } from '../interfaces/DatabaseProvider';
import { Logger } from '../../utils/logger';
import { ErrorHandler } from '../../utils/errorHandler';

export class SQLiteProvider implements DatabaseProvider {
    private db: sqlite3.Database | null = null;
    private dbFile: string;
    private logger: Logger;
    private errorHandler: ErrorHandler;

    constructor(dbFile: string, logger: Logger, errorHandler: ErrorHandler) {
        this.dbFile = dbFile;
        this.logger = logger;
        this.errorHandler = errorHandler;
    }

    async connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbFile, (err) => {
                if (err) {
                    this.logger.error('Failed to connect to SQLite database', { error: err.message, dbFile: this.dbFile });
                    reject(this.errorHandler.createDatabaseError('Failed to connect to database'));
                } else {
                    resolve();
                }
            });
        });
    }

    async disconnect(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                resolve();
                return;
            }

            this.db.close((err) => {
                if (err) {
                    this.logger.error('Error closing SQLite database', { error: err.message });
                    reject(err);
                } else {
                    if (process.env.NODE_ENV === 'development') {
                        this.logger.info('SQLite database connection closed');
                    }
                    resolve();
                }
            });
        });
    }

    async initializeSchema(schema: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not connected'));
                return;
            }

            this.db.exec(schema, (err) => {
                if (err) {
                    this.logger.error('Failed to initialize SQLite schema', { error: err.message });
                    reject(this.errorHandler.createDatabaseError('Failed to initialize schema'));
                } else {
                    resolve();
                }
            });
        });
    }

    async create(table: string, data: Record<string, any>): Promise<number> {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not connected'));
                return;
            }

            const keys = Object.keys(data).join(', ');
            const values = Object.values(data).map(() => '?').join(', ');
            const sql = `INSERT INTO ${table} (${keys}) VALUES (${values})`;
            
            this.db.run(sql, Object.values(data), function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    }

    async read(table: string, conditions: Record<string, any> = {}): Promise<any[]> {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not connected'));
                return;
            }

            let sql = `SELECT * FROM ${table}`;
            let params: any[] = [];

            if (Object.keys(conditions).length > 0) {
                const whereClause = Object.keys(conditions).map(key => `${key} = ?`).join(' AND ');
                sql += ` WHERE ${whereClause}`;
                params = Object.values(conditions);
            }

            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    async update(table: string, data: Record<string, any>, conditions: Record<string, any>): Promise<number> {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not connected'));
                return;
            }

            const setClause = Object.keys(data).map(key => `${key} = ?`).join(', ');
            const whereClause = Object.keys(conditions).map(key => `${key} = ?`).join(' AND ');
            const sql = `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`;
            
            this.db.run(sql, [...Object.values(data), ...Object.values(conditions)], function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    async delete(table: string, conditions: Record<string, any>): Promise<number> {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not connected'));
                return;
            }

            const whereClause = Object.keys(conditions).map(key => `${key} = ?`).join(' AND ');
            const sql = `DELETE FROM ${table} WHERE ${whereClause}`;
            
            this.db.run(sql, Object.values(conditions), function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    async findById(table: string, id: number | string): Promise<any | null> {
        const results = await this.read(table, { id });
        return results.length > 0 ? results[0] : null;
    }

    async findByField(table: string, field: string, value: any): Promise<any[]> {
        return this.read(table, { [field]: value });
    }

    async query(sql: string, params: any[] = []): Promise<any[]> {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not connected'));
                return;
            }

            this.db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }

    async execute(sql: string, params: any[] = []): Promise<DatabaseResult> {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not connected'));
                return;
            }

            this.db.run(sql, params, function (err) {
                if (err) reject(err);
                else resolve({ 
                    insertId: this.lastID, 
                    affectedRows: this.changes 
                });
            });
        });
    }

    async beginTransaction(): Promise<void> {
        return this.execute('BEGIN TRANSACTION').then(() => {});
    }

    async commitTransaction(): Promise<void> {
        return this.execute('COMMIT').then(() => {});
    }

    async rollbackTransaction(): Promise<void> {
        return this.execute('ROLLBACK').then(() => {});
    }
}

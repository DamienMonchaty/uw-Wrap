export interface DatabaseResult {
    insertId?: number;
    affectedRows?: number;
}

export interface DatabaseProvider {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    
    // CRUD operations (higher level)
    create(table: string, data: Record<string, any>): Promise<number | string>;
    read(table: string, conditions?: Record<string, any>): Promise<any[]>;
    update(table: string, data: Record<string, any>, conditions: Record<string, any>): Promise<number>;
    delete(table: string, conditions: Record<string, any>): Promise<number>;
    findById(table: string, id: number | string): Promise<any | null>;
    findByField(table: string, field: string, value: any): Promise<any[]>;
    
    // Raw SQL operations (lower level)
    query(sql: string, params?: any[]): Promise<any[]>;
    execute(sql: string, params?: any[]): Promise<DatabaseResult>;
    
    // Schema management
    initializeSchema(schema: string): Promise<void>;
    
    // Transaction support
    beginTransaction(): Promise<void>;
    commitTransaction(): Promise<void>;
    rollbackTransaction(): Promise<void>;
}

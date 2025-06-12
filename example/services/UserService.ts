// filepath: c:\Users\Formation\Documents\Dev\nodejs\uW-Wrap\example\services\UserService_New.ts
import { Logger } from '../../src/utils/logger';
import { AppError, ErrorCode } from '../../src/utils/errorHandler';
import { User, UserCreateInput, UserUpdateInput } from '../models/User';
import { Service } from '../../src/core/AutoRegistration';
import 'reflect-metadata';

/**
 * User Service Interface
 */
export interface UserService {
    getAllUsers(): Promise<User[]>;
    getUserById(id: number): Promise<User | null>;
    getUserByEmail(email: string): Promise<User | null>;
    getUserByUsername(username: string): Promise<User | null>;
    createUser(userData: UserCreateInput): Promise<User>;
    updateUser(id: number, userData: UserUpdateInput): Promise<User | null>;
    deleteUser(id: number): Promise<boolean>;
}

/**
 * Simple User Service Implementation - In-Memory Storage
 * Simplified version without repository for demonstration
 */
@Service('UserService')
export class UserServiceImpl implements UserService {
    private users: User[] = [];
    private nextId: number = 1;
    private logger: Logger;

    constructor(logger: Logger) {
        this.logger = logger;
        
        // Initialize with some sample data
        this.initializeSampleData();
    }

    private initializeSampleData(): void {
        this.users = [
            {
                id: 1,
                username: 'admin',
                email: 'admin@example.com',
                name: 'Administrator',
                role: 'admin',
                created_at: new Date(),
                updated_at: new Date()
            },
            {
                id: 2,
                username: 'user1',
                email: 'user1@example.com',
                name: 'John Doe',
                role: 'user',
                created_at: new Date(),
                updated_at: new Date()
            }
        ];
        this.nextId = 3;
    }

    /**
     * Get all users
     */
    async getAllUsers(): Promise<User[]> {
        this.logger.info('Fetching all users');
        return [...this.users]; // Return copy to prevent external modification
    }

    /**
     * Get user by ID
     */
    async getUserById(id: number): Promise<User | null> {
        this.logger.info(`Fetching user with ID: ${id}`);
        const user = this.users.find(u => u.id === id);
        return user || null;
    }

    /**
     * Get user by email
     */
    async getUserByEmail(email: string): Promise<User | null> {
        this.logger.info(`Fetching user with email: ${email}`);
        const user = this.users.find(u => u.email === email);
        return user || null;
    }

    /**
     * Get user by username
     */
    async getUserByUsername(username: string): Promise<User | null> {
        this.logger.info(`Fetching user with username: ${username}`);
        const user = this.users.find(u => u.username === username);
        return user || null;
    }

    /**
     * Create a new user
     */
    async createUser(userData: UserCreateInput): Promise<User> {
        this.logger.info(`Creating user: ${userData.username}`);
        
        // Check if email already exists
        const existingEmail = await this.getUserByEmail(userData.email);
        if (existingEmail) {
            throw new AppError(
                'Email already exists',
                ErrorCode.VALIDATION_ERROR,
                400,
                { context: 'UserService.createUser', email: userData.email }
            );
        }

        // Check if username already exists
        const existingUsername = await this.getUserByUsername(userData.username);
        if (existingUsername) {
            throw new AppError(
                'Username already exists',
                ErrorCode.VALIDATION_ERROR,
                400,
                { context: 'UserService.createUser', username: userData.username }
            );
        }

        const newUser: User = {
            id: this.nextId++,
            username: userData.username,
            email: userData.email,
            name: userData.name,
            role: userData.role || 'user',
            created_at: new Date(),
            updated_at: new Date()
        };

        this.users.push(newUser);
        this.logger.info(`User created successfully: ${newUser.id}`);
        
        return newUser;
    }

    /**
     * Update user
     */
    async updateUser(id: number, userData: UserUpdateInput): Promise<User | null> {
        this.logger.info(`Updating user: ${id}`);
        
        const userIndex = this.users.findIndex(u => u.id === id);
        if (userIndex === -1) {
            return null;
        }

        // Check if email is being changed and already exists
        if (userData.email && userData.email !== this.users[userIndex].email) {
            const existingEmail = await this.getUserByEmail(userData.email);
            if (existingEmail) {
                throw new AppError(
                    'Email already exists',
                    ErrorCode.VALIDATION_ERROR,
                    400,
                    { context: 'UserService.updateUser', email: userData.email }
                );
            }
        }

        // Check if username is being changed and already exists
        if (userData.username && userData.username !== this.users[userIndex].username) {
            const existingUsername = await this.getUserByUsername(userData.username);
            if (existingUsername) {
                throw new AppError(
                    'Username already exists',
                    ErrorCode.VALIDATION_ERROR,
                    400,
                    { context: 'UserService.updateUser', username: userData.username }
                );
            }
        }

        // Update user data
        this.users[userIndex] = {
            ...this.users[userIndex],
            ...userData,
            updated_at: new Date()
        };

        this.logger.info(`User updated successfully: ${id}`);
        return this.users[userIndex];
    }

    /**
     * Delete user
     */
    async deleteUser(id: number): Promise<boolean> {
        this.logger.info(`Deleting user: ${id}`);
        
        const userIndex = this.users.findIndex(u => u.id === id);
        if (userIndex === -1) {
            return false;
        }

        this.users.splice(userIndex, 1);
        this.logger.info(`User deleted successfully: ${id}`);
        
        return true;
    }
}

// Reflect metadata for dependency injection
Reflect.defineMetadata('design:paramtypes', [Logger], UserServiceImpl);

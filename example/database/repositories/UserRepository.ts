import { CrudRepository } from '../../../src/database/repositories/CrudRepository';
import { DatabaseProvider } from '../../../src/database/interfaces/DatabaseProvider';
import { ErrorHandler } from '../../../src/utils/errorHandler';
import { User } from '../../models/User';

/**
 * Specialized User Repository with domain-specific methods
 * Extends the generic CrudRepository with User-specific business logic
 */
export class UserRepository extends CrudRepository<User> {
    constructor(provider: DatabaseProvider, errorHandler: ErrorHandler) {
        super(provider, {
            tableName: 'users',
            primaryKey: 'id'
        }, errorHandler);
    }

    /**
     * Check if email already exists
     */
    async emailExists(email: string): Promise<boolean> {
        return this.existsBy('email', email);
    }

    /**
     * Check if username already exists
     */
    async usernameExists(username: string): Promise<boolean> {
        return this.existsBy('username', username);
    }

    /**
     * Find user by email
     */
    async findByEmail(email: string): Promise<User | null> {
        return this.findOneBy('email', email);
    }

    /**
     * Find user by username
     */
    async findByUsername(username: string): Promise<User | null> {
        return this.findOneBy('username', username);
    }

    /**
     * Find users by role
     */
    async findByRole(role: string): Promise<User[]> {
        return this.findBy('role', role);
    }

    /**
     * Create a new user with validation and defaults
     */
    async createUser(userData: Omit<User, 'id' | 'created_at' | 'updated_at'>): Promise<User> {
        try {
            // Validate unique constraints
            if (await this.emailExists(userData.email)) {
                throw this.errorHandler.createConflictError(
                    'Email already exists',
                    'users',
                    'email'
                );
            }

            if (await this.usernameExists(userData.username)) {
                throw this.errorHandler.createConflictError(
                    'Username already exists',
                    'users',
                    'username'
                );
            }

            // Prepare user data with defaults
            const userToCreate: Omit<User, 'id'> = {
                ...userData,
                role: userData.role || 'user',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            return this.create(userToCreate);
        } catch (error) {
            // Re-throw AppError instances as-is using multiple checks
            if (error instanceof Error && (
                error.name === 'AppError' ||
                (error as any).code && (error as any).statusCode
            )) {
                throw error;
            }
            
            // Wrap unexpected errors
            throw this.errorHandler.createDatabaseError(
                'Failed to create user',
                'createUser',
                'users',
                { email: userData.email, originalError: error }
            );
        }
    }

    /**
     * Update user with automatic timestamp
     */
    async updateUser(id: number, userData: Partial<Omit<User, 'id' | 'created_at'>>): Promise<User | null> {
        try {
            const updateData = {
                ...userData,
                updated_at: new Date().toISOString()
            };

            return this.updateById(id, updateData);
        } catch (error) {
            // Re-throw AppError instances as-is using multiple checks
            if (error instanceof Error && (
                error.name === 'AppError' ||
                (error as any).code && (error as any).statusCode
            )) {
                throw error;
            }
            
            // Wrap unexpected errors
            throw this.errorHandler.createDatabaseError(
                'Failed to update user',
                'updateUser',
                'users',
                { id, originalError: error }
            );
        }
    }

    /**
     * Get all admin users
     */
    async getAdmins(): Promise<User[]> {
        return this.findByRole('admin');
    }

    /**
     * Promote user to admin
     */
    async promoteToAdmin(id: number): Promise<User | null> {
        return this.updateUser(id, { role: 'admin' });
    }

    /**
     * Demote user from admin
     */
    async demoteFromAdmin(id: number): Promise<User | null> {
        return this.updateUser(id, { role: 'user' });
    }

    /**
     * Soft delete user (if soft delete is implemented)
     */
    async deactivateUser(id: number): Promise<User | null> {
        return this.updateUser(id, { 
            // Add your soft delete field here, e.g., deleted_at: new Date().toISOString()
        });
    }
}

import { Logger } from '../../src/utils/logger';
import { AppError, ErrorCode, ErrorSeverity, ErrorCategory } from '../../src/utils/errorHandler';
import { AppRepositoryManager } from '../database/AppRepositoryManager';
import { User, UserCreateInput, UserUpdateInput } from '../models/User';

/**
 * User Service Interface
 */
export interface UserService {
    getAllUsers(): Promise<User[]>;
    getUserById(id: number): Promise<User | null>;
    getUserByEmail(email: string): Promise<User | null>;
    getUserByUsername(username: string): Promise<User | null>;
    createUser(userData: UserCreateInput): Promise<User>;
    createMultipleUsers(users: UserCreateInput[]): Promise<User[]>;
    updateUser(id: number, userData: UserUpdateInput): Promise<User | null>;
    deleteUser(id: number): Promise<boolean>;
    validateUserCredentials(email: string, password: string): Promise<User | null>;
    getUsersByRole(role: string): Promise<User[]>;
    checkEmailExists(email: string): Promise<boolean>;
    checkUsernameExists(username: string): Promise<boolean>;
    getUserStats(): Promise<{ totalUsers: number; adminCount: number; userCount: number; recentUsers: number }>;
    promoteUserToAdmin(id: number): Promise<User | null>;
    demoteUserFromAdmin(id: number): Promise<User | null>;
}

/**
 * User Service Implementation with IoC
 * Handles all user-related business logic using the repository pattern
 */
export class UserServiceImpl implements UserService {
    private repositories: AppRepositoryManager;
    private logger: Logger;

    constructor(repositories: AppRepositoryManager, logger: Logger) {
        this.repositories = repositories;
        this.logger = logger;
    }

    /**
     * Get all users
     */
    async getAllUsers(): Promise<User[]> {
        this.logger.info('Fetching all users');
        try {
            return await this.repositories.users.findAll();
        } catch (error) {
            this.logger.error('Error fetching all users:', error);
            throw new AppError(
                'Failed to fetch users',
                ErrorCode.DATABASE_ERROR,
                500,
                { context: 'UserService.getAllUsers', originalError: error }
            );
        }
    }

    /**
     * Get user by ID
     */
    async getUserById(id: number): Promise<User | null> {
        this.logger.info(`Fetching user with ID: ${id}`);
        try {
            return await this.repositories.users.findById(id);
        } catch (error) {
            this.logger.error(`Error fetching user ${id}:`, error);
            throw new AppError(
                `Failed to fetch user with ID ${id}`,
                ErrorCode.DATABASE_ERROR,
                500,
                { context: 'UserService.getUserById', userId: id.toString(), originalError: error }
            );
        }
    }

    /**
     * Get user by email
     */
    async getUserByEmail(email: string): Promise<User | null> {
        this.logger.info(`Fetching user with email: ${email}`);
        try {
            return await this.repositories.users.findByEmail(email);
        } catch (error) {
            this.logger.error(`Error fetching user by email ${email}:`, error);
            throw new AppError(
                `Failed to fetch user with email ${email}`,
                ErrorCode.DATABASE_ERROR,
                500,
                { context: 'UserService.getUserByEmail', email, originalError: error }
            );
        }
    }

    /**
     * Get user by username
     */
    async getUserByUsername(username: string): Promise<User | null> {
        this.logger.info(`Fetching user with username: ${username}`);
        try {
            return await this.repositories.users.findByUsername(username);
        } catch (error) {
            this.logger.error(`Error fetching user by username ${username}:`, error);
            throw new AppError(
                `Failed to fetch user with username ${username}`,
                ErrorCode.DATABASE_ERROR,
                500,
                { context: 'UserService.getUserByUsername', username, originalError: error }
            );
        }
    }

    /**
     * Create a new user
     */
    async createUser(userData: UserCreateInput): Promise<User> {
        this.logger.info(`Creating new user: ${userData.email}`);
        
        console.log('UserService.createUser - Starting validation checks');
        
        try {
            // Validate unique constraints directly and throw proper errors
            console.log('UserService.createUser - Checking email exists:', userData.email);
            const emailExists = await this.repositories.users.emailExists(userData.email);
            console.log('UserService.createUser - Email exists result:', emailExists);
            
            if (emailExists) {
                console.log('UserService.createUser - Email exists, throwing CONFLICT error');
                throw new AppError(
                    'Email already exists',
                    ErrorCode.CONFLICT,
                    409,
                    { context: 'UserService.createUser', email: userData.email, field: 'email' }
                );
            }

            console.log('UserService.createUser - Checking username exists:', userData.username);
            const usernameExists = await this.repositories.users.usernameExists(userData.username);
            console.log('UserService.createUser - Username exists result:', usernameExists);
            
            if (usernameExists) {
                console.log('UserService.createUser - Username exists, throwing CONFLICT error');
                throw new AppError(
                    'Username already exists',
                    ErrorCode.CONFLICT,
                    409,
                    { context: 'UserService.createUser', username: userData.username, field: 'username' }
                );
            }

            console.log('UserService.createUser - Validation passed, creating user');
            
            // Create user with default role if not specified
            const userToCreate: UserCreateInput = {
                ...userData,
                role: userData.role || 'user'
            };

            console.log('UserService.createUser - Calling repository.create');
            const createdUser = await this.repositories.users.create(userToCreate);
            console.log('UserService.createUser - User created successfully:', createdUser.id);
            this.logger.info(`User created successfully: ${createdUser.id}`);
            return createdUser;
        } catch (error) {
            console.log('UserService.createUser - Error caught:', {
                name: error instanceof Error ? error.name : 'unknown',
                message: error instanceof Error ? error.message : 'unknown',
                isAppError: error instanceof AppError,
                hasCode: !!(error as any).code,
                code: (error as any).code
            });
            
            // If it's already an AppError, re-throw it
            if (error instanceof AppError) {
                console.log('UserService.createUser - Re-throwing AppError');
                throw error;
            }
            
            this.logger.error('Error creating user in repository:', error);
            
            // Wrap database errors
            console.log('UserService.createUser - Wrapping as DATABASE_ERROR');
            throw new AppError(
                'Failed to create user',
                ErrorCode.DATABASE_ERROR,
                500,
                { context: 'UserService.createUser', email: userData.email, originalError: error }
            );
        }
    }

    /**
     * Create multiple users (batch operation)
     */
    async createMultipleUsers(users: UserCreateInput[]): Promise<User[]> {
        this.logger.info(`Creating ${users.length} users`);
        
        const createdUsers: User[] = [];
        const errors: string[] = [];

        for (const userData of users) {
            try {
                const user = await this.createUser(userData);
                createdUsers.push(user);
            } catch (error) {
                const errorMsg = `Failed to create user ${userData.email}: ${error instanceof Error ? error.message : 'Unknown error'}`;
                errors.push(errorMsg);
                this.logger.error(errorMsg);
            }
        }

        if (errors.length > 0 && createdUsers.length === 0) {
            throw new AppError(
                `Failed to create any users: ${errors.join(', ')}`,
                ErrorCode.BUSINESS_RULE_VIOLATION,
                400,
                { context: 'UserService.createMultipleUsers', errors, failedCount: users.length }
            );
        }

        if (errors.length > 0) {
            this.logger.warn(`Partial success: Created ${createdUsers.length}/${users.length} users. Errors: ${errors.join(', ')}`);
        }

        return createdUsers;
    }

    /**
     * Update an existing user
     */
    async updateUser(id: number, userData: UserUpdateInput): Promise<User | null> {
        this.logger.info(`Updating user: ${id}`);
        
        try {
            // Check if user exists
            const existingUser = await this.repositories.users.findById(id);
            if (!existingUser) {
                throw new AppError(
                    `User with ID ${id} not found`,
                    ErrorCode.NOT_FOUND,
                    404,
                    { context: 'UserService.updateUser', userId: id.toString(), resource: 'user' }
                );
            }

            // Validate unique constraints if email or username is being updated
            if (userData.email && userData.email !== existingUser.email) {
                const emailExists = await this.repositories.users.emailExists(userData.email);
                if (emailExists) {
                    throw new AppError(
                        'Email already exists',
                        ErrorCode.CONFLICT,
                        409,
                        { context: 'UserService.updateUser', email: userData.email, field: 'email' }
                    );
                }
            }

            if (userData.username && userData.username !== existingUser.username) {
                const usernameExists = await this.repositories.users.usernameExists(userData.username);
                if (usernameExists) {
                    throw new AppError(
                        'Username already exists',
                        ErrorCode.CONFLICT,
                        409,
                        { context: 'UserService.updateUser', username: userData.username, field: 'username' }
                    );
                }
            }

            const updatedUser = await this.repositories.users.updateById(id, userData);
            this.logger.info(`User updated successfully: ${id}`);
            return updatedUser;
        } catch (error) {
            this.logger.error(`Error updating user ${id}:`, error);
            
            // Re-throw AppError instances as-is using multiple checks
            if (error instanceof AppError || 
                (error as any).name === 'AppError' ||
                ((error as any).code && (error as any).statusCode)) {
                throw error;
            }
            
            // Wrap unknown errors
            throw new AppError(
                `Failed to update user with ID ${id}`,
                ErrorCode.DATABASE_ERROR,
                500,
                { context: 'UserService.updateUser', userId: id.toString(), originalError: error }
            );
        }
    }

    /**
     * Delete a user
     */
    async deleteUser(id: number): Promise<boolean> {
        this.logger.info(`Deleting user: ${id}`);
        
        try {
            const result = await this.repositories.users.deleteById(id);
            if (result) {
                this.logger.info(`User deleted successfully: ${id}`);
            } else {
                this.logger.warn(`User not found for deletion: ${id}`);
            }
            return result;
        } catch (error) {
            this.logger.error(`Error deleting user ${id}:`, error);
            throw new AppError(
                `Failed to delete user with ID ${id}`,
                ErrorCode.DATABASE_ERROR,
                500,
                { context: 'UserService.deleteUser', userId: id.toString(), originalError: error }
            );
        }
    }

    /**
     * Validate user credentials (for authentication)
     */
    async validateUserCredentials(email: string, password: string): Promise<User | null> {
        this.logger.info(`Validating credentials for: ${email}`);
        
        try {
            const user = await this.repositories.users.findByEmail(email);
            if (!user || !user.password_hash) {
                return null;
            }

            // In a real application, you would hash the password and compare
            // For this example, we'll do a simple comparison
            // TODO: Implement proper password hashing with bcrypt
            if (user.password_hash === password) {
                this.logger.info(`Credentials validated for: ${email}`);
                return user;
            }

            this.logger.warn(`Invalid credentials for: ${email}`);
            return null;
        } catch (error) {
            this.logger.error(`Error validating credentials for ${email}:`, error);
            throw new AppError(
                'Failed to validate credentials',
                ErrorCode.DATABASE_ERROR,
                500,
                { context: 'UserService.validateUserCredentials', email, originalError: error }
            );
        }
    }

    /**
     * Get users by role
     */
    async getUsersByRole(role: string): Promise<User[]> {
        this.logger.info(`Fetching users with role: ${role}`);
        
        try {
            return await this.repositories.users.findByRole(role);
        } catch (error) {
            this.logger.error(`Error fetching users by role ${role}:`, error);
            throw new AppError(
                `Failed to fetch users with role ${role}`,
                ErrorCode.DATABASE_ERROR,
                500,
                { context: 'UserService.getUsersByRole', role, originalError: error }
            );
        }
    }

    /**
     * Get user statistics
     */
    async getUserStats(): Promise<{ totalUsers: number; adminCount: number; userCount: number; recentUsers: number }> {
        this.logger.info('Fetching user statistics');
        
        try {
            const allUsers = await this.repositories.users.findAll();
            const adminUsers = await this.repositories.users.findByRole('admin');
            const regularUsers = await this.repositories.users.findByRole('user');
            
            // Calculate recent users (last 30 days)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            const recentUsers = allUsers.filter(user => {
                if (!user.created_at) return false;
                const createdDate = new Date(user.created_at);
                return createdDate >= thirtyDaysAgo;
            });

            const stats = {
                totalUsers: allUsers.length,
                adminCount: adminUsers.length,
                userCount: regularUsers.length,
                recentUsers: recentUsers.length
            };

            this.logger.info('User statistics calculated', stats);
            return stats;
        } catch (error) {
            this.logger.error('Error fetching user statistics:', error);
            throw new AppError(
                'Failed to fetch user statistics',
                ErrorCode.DATABASE_ERROR,
                500,
                { context: 'UserService.getUserStats', originalError: error }
            );
        }
    }

    /**
     * Promote user to admin
     */
    async promoteUserToAdmin(id: number): Promise<User | null> {
        this.logger.info(`Promoting user to admin: ${id}`);
        
        try {
            const user = await this.repositories.users.findById(id);
            if (!user) {
                throw new AppError(
                    `User with ID ${id} not found`,
                    ErrorCode.NOT_FOUND,
                    404,
                    { context: 'UserService.promoteUserToAdmin', userId: id.toString(), resource: 'user' }
                );
            }

            if (user.role === 'admin') {
                this.logger.warn(`User ${id} is already an admin`);
                return user;
            }

            const updatedUser = await this.repositories.users.promoteToAdmin(id);
            this.logger.info(`User ${id} promoted to admin successfully`);
            return updatedUser;
        } catch (error) {
            this.logger.error(`Error promoting user ${id} to admin:`, error);
            
            // Re-throw AppError instances as-is using multiple checks
            if (error instanceof AppError || 
                (error as any).name === 'AppError' ||
                ((error as any).code && (error as any).statusCode)) {
                throw error;
            }
            
            // Wrap unknown errors
            throw new AppError(
                `Failed to promote user ${id} to admin`,
                ErrorCode.DATABASE_ERROR,
                500,
                { context: 'UserService.promoteUserToAdmin', userId: id.toString(), originalError: error }
            );
        }
    }

    /**
     * Demote user from admin
     */
    async demoteUserFromAdmin(id: number): Promise<User | null> {
        this.logger.info(`Demoting user from admin: ${id}`);
        
        try {
            const user = await this.repositories.users.findById(id);
            if (!user) {
                throw new AppError(
                    `User with ID ${id} not found`,
                    ErrorCode.NOT_FOUND,
                    404,
                    { context: 'UserService.demoteUserFromAdmin', userId: id.toString(), resource: 'user' }
                );
            }

            if (user.role !== 'admin') {
                this.logger.warn(`User ${id} is not an admin`);
                return user;
            }

            const updatedUser = await this.repositories.users.demoteFromAdmin(id);
            this.logger.info(`User ${id} demoted from admin successfully`);
            return updatedUser;
        } catch (error) {
            this.logger.error(`Error demoting user ${id} from admin:`, error);
            
            // Re-throw AppError instances as-is
            if (error instanceof AppError) {
                throw error;
            }
            
            // Wrap unknown errors
            throw new AppError(
                `Failed to demote user ${id} from admin`,
                ErrorCode.DATABASE_ERROR,
                500,
                { context: 'UserService.demoteUserFromAdmin', userId: id.toString(), originalError: error }
            );
        }
    }

    /**
     * Check if email exists
     */
    async checkEmailExists(email: string): Promise<boolean> {
        try {
            return await this.repositories.users.emailExists(email);
        } catch (error) {
            this.logger.error(`Error checking email existence ${email}:`, error);
            throw new AppError(
                'Failed to check email existence',
                ErrorCode.DATABASE_ERROR,
                500,
                { context: 'UserService.checkEmailExists', email, originalError: error }
            );
        }
    }

    /**
     * Check if username exists
     */
    async checkUsernameExists(username: string): Promise<boolean> {
        try {
            return await this.repositories.users.usernameExists(username);
        } catch (error) {
            this.logger.error(`Error checking username existence ${username}:`, error);
            throw new AppError(
                'Failed to check username existence',
                ErrorCode.DATABASE_ERROR,
                500,
                { context: 'UserService.checkUsernameExists', username, originalError: error }
            );
        }
    }
}

import { BaseHandler } from '../../src/core/BaseHandler';
import { UWebSocketWrapper } from '../../src/core/uWebSocketWrapper';
import { Logger } from '../../src/utils/logger';
import { ErrorHandler } from '../../src/utils/errorHandler';
import { UserServiceImpl } from '../services/UserService';

/**
 * User management handler
 */
export class UserHandler extends BaseHandler {
    private userService: UserServiceImpl;

    constructor(
        server: UWebSocketWrapper,
        logger: Logger,
        errorHandler: ErrorHandler,
        userService: UserServiceImpl
    ) {
        super(server, logger, errorHandler);
        this.userService = userService;
    }

    registerRoutes(): void {
        // Basic CRUD operations
        this.server.addHttpHandler('post', '/users', (req, res) => 
            this.handleAsync(req, res, this.createUser.bind(this), 'Create User')
        );

        this.server.addHttpHandler('get', '/users', (req, res) => 
            this.handleAsync(req, res, this.getAllUsers.bind(this), 'Get All Users')
        );

        this.server.addHttpHandler('get', '/users/:id', (req, res) => 
            this.handleAsync(req, res, this.getUserById.bind(this), 'Get User By ID')
        );

        this.server.addHttpHandler('put', '/users/:id', (req, res) => 
            this.handleAsync(req, res, this.updateUser.bind(this), 'Update User')
        );

        this.server.addHttpHandler('delete', '/users/:id', (req, res) => 
            this.handleAsync(req, res, this.deleteUser.bind(this), 'Delete User')
        );

        // Advanced operations
        this.server.addHttpHandler('post', '/users/batch', (req, res) => 
            this.handleAsync(req, res, this.createBatchUsers.bind(this), 'Batch Create Users')
        );

        this.server.addHttpHandler('get', '/users/by-role/:role', (req, res) => 
            this.handleAsync(req, res, this.getUsersByRole.bind(this), 'Get Users By Role')
        );

        // Statistics and management
        this.server.addHttpHandler('get', '/api/v1/users/stats', (req, res) => 
            this.handleAsync(req, res, this.getUserStats.bind(this), 'Get User Stats')
        );

        this.server.addHttpHandler('post', '/api/v1/users/:id/promote', (req, res) => 
            this.handleAsync(req, res, this.promoteUser.bind(this), 'Promote User')
        );

        this.server.addHttpHandler('post', '/api/v1/users/:id/demote', (req, res) => 
            this.handleAsync(req, res, this.demoteUser.bind(this), 'Demote User')
        );
    }

    /**
     * Create a new user
     */
    private async createUser(req: any, res: any): Promise<void> {
        const userData = await this.parseJsonBody(res);
        
        // Validate required fields using new validation method
        this.validateRequiredFields(userData, ['username', 'email', 'name']);
        
        // Additional business validation
        if (userData.email && !this.isValidEmail(userData.email)) {
            this.createValidationError('Invalid email format', 'email', userData.email);
        }
        
        const user = await this.userService.createUser({
            username: userData.username,
            email: userData.email,
            name: userData.name
        });
        
        this.sendSuccess(res, { 
            userId: user.id,
            user
        }, 'User created successfully');
    }

    /**
     * Validate email format
     */
    private isValidEmail(email: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Get all users
     */
    private async getAllUsers(req: any, res: any): Promise<void> {
        const users = await this.userService.getAllUsers();
        this.sendSuccess(res, { users });
    }

    /**
     * Get user by ID
     */
    private async getUserById(req: any, res: any): Promise<void> {
        const userId = req.getParameter(0);
        
        // Validate input using new error methods
        if (!userId) {
            this.createValidationError('User ID is required', 'userId');
        }

        const user = await this.userService.getUserById(parseInt(userId));
        
        if (!user) {
            this.createNotFoundError('User', userId);
        }

        this.sendSuccess(res, { user });
    }

    /**
     * Update user
     */
    private async updateUser(req: any, res: any): Promise<void> {
        const userId = req.getParameter(0);
        
        if (!userId) {
            this.sendError(res, 'User ID is required');
            return;
        }

        const updateData = await this.parseJsonBody(res);
        const user = await this.userService.updateUser(parseInt(userId), updateData);
        
        if (!user) {
            this.sendError(res, 'User not found', 404);
            return;
        }

        this.sendSuccess(res, { user }, 'User updated successfully');
    }

    /**
     * Delete user
     */
    private async deleteUser(req: any, res: any): Promise<void> {
        const userId = req.getParameter(0);
        
        if (!userId) {
            this.sendError(res, 'User ID is required');
            return;
        }

        const deleted = await this.userService.deleteUser(parseInt(userId));
        
        if (!deleted) {
            this.sendError(res, 'User not found', 404);
            return;
        }

        this.sendSuccess(res, {}, 'User deleted successfully');
    }

    /**
     * Create multiple users
     */
    private async createBatchUsers(req: any, res: any): Promise<void> {
        const { users } = await this.parseJsonBody(res);
        
        if (!users || !Array.isArray(users)) {
            this.sendError(res, 'Users array is required');
            return;
        }

        const result = await this.userService.createMultipleUsers(users);
        
        this.sendSuccess(res, { 
            users: result 
        }, `${result.length} users created successfully`);
    }

    /**
     * Get users by role
     */
    private async getUsersByRole(req: any, res: any): Promise<void> {
        const role = req.getParameter(0);
        
        if (!role) {
            this.sendError(res, 'Role is required');
            return;
        }

        const users = await this.userService.getUsersByRole(role);
        this.sendSuccess(res, { users, role });
    }

    /**
     * Get user statistics
     */
    private async getUserStats(req: any, res: any): Promise<void> {
        const stats = await this.userService.getUserStats();
        this.sendSuccess(res, { stats });
    }

    /**
     * Promote user to admin
     */
    private async promoteUser(req: any, res: any): Promise<void> {
        const userId = req.getParameter(0);
        
        if (!userId) {
            this.sendError(res, 'User ID is required');
            return;
        }

        const user = await this.userService.promoteUserToAdmin(parseInt(userId));
        
        if (!user) {
            this.sendError(res, 'User not found', 404);
            return;
        }

        this.sendSuccess(res, { user }, 'User promoted to admin successfully');
    }

    /**
     * Demote user from admin
     */
    private async demoteUser(req: any, res: any): Promise<void> {
        const userId = req.getParameter(0);
        
        if (!userId) {
            this.sendError(res, 'User ID is required');
            return;
        }

        const user = await this.userService.demoteUserFromAdmin(parseInt(userId));
        
        if (!user) {
            this.sendError(res, 'User not found', 404);
            return;
        }

        this.sendSuccess(res, { user }, 'User demoted from admin successfully');
    }
}

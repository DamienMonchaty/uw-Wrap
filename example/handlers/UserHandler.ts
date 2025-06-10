import { Route, GET, POST, PUT, DELETE, Auth, Validate } from '../../src/core/RouteDecorators';
import { HttpHandler } from '../../src/core/HttpHandler';
import { UWebSocketWrapper } from '../../src/core/ServerWrapper';
import { Logger } from '../../src/utils/logger';
import { ErrorHandler } from '../../src/utils/errorHandler';
import { Controller } from '../../src/core/AutoRegistration';
import { UserServiceImpl } from '../services/UserService';

// Validation schemas
export const CreateUserSchema = {
    type: 'object',
    required: ['username', 'email', 'name'],
    properties: {
        username: { type: 'string', minLength: 3, maxLength: 50 },
        email: { type: 'string', format: 'email' },
        name: { type: 'string', minLength: 1, maxLength: 100 },
        password: { type: 'string', minLength: 6 },
        role: { type: 'string', enum: ['user', 'admin', 'moderator'] }
    }
};

export const UpdateUserSchema = {
    type: 'object',
    properties: {
        username: { type: 'string', minLength: 3, maxLength: 50 },
        email: { type: 'string', format: 'email' },
        name: { type: 'string', minLength: 1, maxLength: 100 },
        role: { type: 'string', enum: ['user', 'admin', 'moderator'] }
    }
};

export const BatchUsersSchema = {
    type: 'object',
    required: ['users'],
    properties: {
        users: {
            type: 'array',
            items: CreateUserSchema
        }
    }
};

/**
 * User management handler using modern decorator system with auto-registration
 */
@Controller('UserHandler') // ← Auto-registration as controller
@Route('/users')
export class UserHandler extends HttpHandler {
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

    /**
     * Create a new user
     */
    @POST('/')
    @Validate(CreateUserSchema)
    @Auth(['admin', 'moderator'])
    async createUser(req: any, res: any) {
        const userData = this.getRequestBody(req, res);
        
        const user = await this.userService.createUser({
            username: userData.username,
            email: userData.email,
            name: userData.name
        });
        
        this.logger.info(`User created successfully: ${user.id}`);
        
        return { 
            success: true,
            data: {
                userId: user.id,
                user
            },
            message: 'User created successfully'
        };
    }

    /**
     * Get all users
     */
    @GET('/')
    @Auth()
    async getAllUsers(req: any, res: any) {
        const users = await this.userService.getAllUsers();
        
        this.logger.info(`Retrieved ${users.length} users`);
        
        return {
            success: true,
            data: { users },
            total: users.length
        };
    }

    /**
     * Get user by ID
     */
    @GET('/:id')
    @Auth()
    async getUserById(req: any, res: any) {
        const { id } = this.getPathParams(req);
        
        if (!id) {
            this.createValidationError('User ID is required', 'id');
        }

        const user = await this.userService.getUserById(parseInt(id));
        
        if (!user) {
            this.createNotFoundError('User', id);
        }

        this.logger.info(`Retrieved user: ${id}`);
        
        return {
            success: true,
            data: { user }
        };
    }

    /**
     * Update user
     */
    @PUT('/:id')
    @Validate(UpdateUserSchema)
    @Auth(['admin', 'moderator'])
    async updateUser(req: any, res: any) {
        const { id } = this.getPathParams(req);
        
        if (!id) {
            this.createValidationError('User ID is required', 'id');
        }

        const updateData = this.getRequestBody(req, res);
        const user = await this.userService.updateUser(parseInt(id), updateData);
        
        if (!user) {
            this.createNotFoundError('User', id);
        }

        this.logger.info(`User updated successfully: ${id}`);
        
        return {
            success: true,
            data: { user },
            message: 'User updated successfully'
        };
    }

    /**
     * Delete user
     */
    @DELETE('/:id')
    @Auth(['admin'])
    async deleteUser(req: any, res: any) {
        const { id } = this.getPathParams(req);
        
        if (!id) {
            this.createValidationError('User ID is required', 'id');
        }

        const deleted = await this.userService.deleteUser(parseInt(id));
        
        if (!deleted) {
            this.createNotFoundError('User', id);
        }

        this.logger.info(`User deleted successfully: ${id}`);
        
        return {
            success: true,
            message: 'User deleted successfully'
        };
    }

    /**
     * Create multiple users
     */
    @POST('/batch')
    @Validate(BatchUsersSchema)
    @Auth(['admin'])
    async createBatchUsers(req: any, res: any) {
        const { users } = this.getRequestBody(req, res);
        
        const result = await this.userService.createMultipleUsers(users);
        
        this.logger.info(`Created ${result.length} users in batch`);
        
        return {
            success: true,
            data: { users: result },
            message: `${result.length} users created successfully`
        };
    }

    /**
     * Get users by role
     */
    @GET('/by-role/:role')
    @Auth(['admin', 'moderator'])
    async getUsersByRole(req: any, res: any) {
        const { role } = this.getPathParams(req);
        
        if (!role) {
            this.createValidationError('Role is required', 'role');
        }

        const users = await this.userService.getUsersByRole(role);
        
        this.logger.info(`Retrieved ${users.length} users with role: ${role}`);
        
        return {
            success: true,
            data: { users, role },
            total: users.length
        };
    }

    /**
     * Get user statistics
     */
    @GET('/stats')
    @Auth(['admin'])
    async getUserStats(req: any, res: any) {
        const stats = await this.userService.getUserStats();
        
        this.logger.info('Retrieved user statistics');
        
        return {
            success: true,
            data: { stats }
        };
    }

    /**
     * Promote user to admin
     */
    @POST('/:id/promote')
    @Auth(['admin'])
    async promoteUser(req: any, res: any) {
        const { id } = this.getPathParams(req);
        
        if (!id) {
            this.createValidationError('User ID is required', 'id');
        }

        const user = await this.userService.promoteUserToAdmin(parseInt(id));
        
        if (!user) {
            this.createNotFoundError('User', id);
        }

        this.logger.info(`User promoted to admin: ${id}`);
        
        return {
            success: true,
            data: { user },
            message: 'User promoted to admin successfully'
        };
    }

    /**
     * Demote user from admin
     */
    @POST('/:id/demote')
    @Auth(['admin'])
    async demoteUser(req: any, res: any) {
        const { id } = this.getPathParams(req);
        
        if (!id) {
            this.createValidationError('User ID is required', 'id');
        }

        const user = await this.userService.demoteUserFromAdmin(parseInt(id));
        
        if (!user) {
            this.createNotFoundError('User', id);
        }

        this.logger.info(`User demoted from admin: ${id}`);
        
        return {
            success: true,
            data: { user },
            message: 'User demoted from admin successfully'
        };
    }

    /**
     * Legacy method - routes are now automatically registered via decorators
     */
    registerRoutes(): void {
        this.logger.info('UserHandler routes are automatically registered via decorators');
    }
}

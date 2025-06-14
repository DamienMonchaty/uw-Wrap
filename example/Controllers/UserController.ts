import { Route, GET, POST, PUT, DELETE } from '../../src/core/decorators/RouteDecorators';
import { Auth } from '../../src/core/decorators/AuthDecorators';
import { Validate } from '../../src/core/decorators/ValidationDecorators';
import { HttpHandler } from '../../src/core/HttpHandler';
import { UWebSocketWrapper } from '../../src/core/ServerWrapper';
import { Logger } from '../../src/utils/logger';
import { ErrorHandler } from '../../src/utils/errorHandler';
import { Controller } from '../../src/core/AutoRegistration';
import { UserServiceImpl } from '../services/UserService';
import { MiddlewareContext } from '../../src/middleware/MiddlewareContext';
import { BaseController } from '../../src/core/BaseController';

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

/**
 * Simple User Handler - Modern implementation with service only (no repository)
 */
@Controller('UserController')
@Route('/users')
export class UserController extends BaseController {
    
    private logger: Logger;
    private userService: UserServiceImpl;    
    
    constructor(
        logger: Logger,
        userService: UserServiceImpl
    ) {
        super();
        this.logger = logger;
        this.userService = userService;
    }
    
    /**
     * Create a new user
     */
    @POST()
    @Validate(CreateUserSchema)
    @Auth(['admin', 'moderator'])
    async createUser(context: MiddlewareContext) {
        try {
            const userData = await context.getRequestBody();

            const user = await this.userService.createUser({
                username: userData.username as string,
                email: userData.email as string,
                name: userData.name as string
            });

            this.logger.info(`User created successfully: ${user.id}`);

            context.sendSuccess({ user }, 'User created successfully');
        } catch (error) {
            this.logger.error('Error creating user:', error);
            context.sendError('Failed to create user', 500);
        }
    }    /**
     * Get all users
     */
    @GET()
    async getAllUsers({ sendSuccess, sendError }: MiddlewareContext) {
        try {
            const users = await this.userService.getAllUsers();

            this.logger.info(`Retrieved ${users.length} users`);

            sendSuccess({ users, total: users.length });
        } catch (error) {
            this.logger.error('Error retrieving users:', error);
            sendError('Failed to retrieve users', 500);
        }
    }

    /**
     * Get user by ID
     */
    @GET('/:id')
    @Auth()
    async getUserById(context: MiddlewareContext) {
        try {
            const { id } = context.getPathParams('/users/:id');
            this.logger.info('Context params:', context.params);


            if (!id) {
                context.sendError('User ID is required', 400);
                return;
            }

            const user = await this.userService.getUserById(parseInt(id));

            if (!user) {
                context.sendError(`User with ID ${id} not found`, 404);
                return;
            }

            this.logger.info(`Retrieved user: ${id}`);

            context.sendSuccess({ user });
        } catch (error) {
            this.logger.error('Error retrieving user:', error);
            context.sendError('Failed to retrieve user', 500);
        }
    }

    /**
     * Update user
     */
    @PUT('/:id')
    @Validate(UpdateUserSchema)
    @Auth(['admin', 'moderator'])
    async updateUser(context: MiddlewareContext) {
        try {
            const { id } = context.getPathParams('/users/:id');

            if (!id) {
                context.sendError('User ID is required', 400);
                return;
            }

            const updateData = await context.getRequestBody();
            const user = await this.userService.updateUser(parseInt(id), updateData);

            if (!user) {
                context.sendError(`User with ID ${id} not found`, 404);
                return;
            }

            this.logger.info(`User updated successfully: ${id}`);

            context.sendSuccess({ user }, 'User updated successfully');
        } catch (error) {
            this.logger.error('Error updating user:', error);
            context.sendError('Failed to update user', 500);
        }
    }

    /**
     * Delete user
     */
    @DELETE('/:id')
    @Auth(['admin'])
    async deleteUser(context: MiddlewareContext) {
        try {
            const { id } = context.getPathParams('/users/:id');

            if (!id) {
                context.sendError('User ID is required', 400);
                return;
            }

            const deleted = await this.userService.deleteUser(parseInt(id));

            if (!deleted) {
                context.sendError(`User with ID ${id} not found`, 404);
                return;
            }

            this.logger.info(`User deleted successfully: ${id}`);

            context.sendSuccess({}, 'User deleted successfully');
        } catch (error) {
            this.logger.error('Error deleting user:', error);
            context.sendError('Failed to delete user', 500);
        }
    }
}

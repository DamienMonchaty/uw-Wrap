import { Route, GET, POST, PUT, DELETE } from '../../src/core/decorators/RouteDecorators';
import { Auth } from '../../src/core/decorators/AuthDecorators';
import { Validate } from '../../src/core/decorators/ValidationDecorators';
import { HttpHandler } from '../../src/core/HttpHandler';
import { UWebSocketWrapper } from '../../src/core/ServerWrapper';
import { Logger } from '../../src/utils/logger';
import { ErrorHandler } from '../../src/utils/errorHandler';
import { Controller } from '../../src/core/AutoRegistration';
import { UserServiceImpl } from '../services/UserService';
import { MiddlewareContext } from '../../src/middleware/AuthenticationMiddleware';

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
@Controller('UserHandler')
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
    }    /**
     * Create a new user
     */
    @POST('/')
    @Validate(CreateUserSchema)
    @Auth(['admin', 'moderator'])
    async createUser(context: MiddlewareContext) {
        try {
            const userData = await this.getRequestBody(context);

            const user = await this.userService.createUser({
                username: userData.username as string,
                email: userData.email as string,
                name: userData.name as string
            });

            this.logger.info(`User created successfully: ${user.id}`);

            this.sendSuccess(context, { user }, 'User created successfully');
        } catch (error) {
            this.logger.error('Error creating user:', error);
            this.sendError(context, 'Failed to create user', 500);
        }
    }    /**
     * Get all users
     */
    @GET('/')
    async getAllUsers(context: MiddlewareContext) {
        try {
            const users = await this.userService.getAllUsers();

            this.logger.info(`Retrieved ${users.length} users`);

            this.sendSuccess(context, { users, total: users.length });
        } catch (error) {
            this.logger.error('Error retrieving users:', error);
            this.sendError(context, 'Failed to retrieve users', 500);
        }
    }

    /**
     * Get user by ID
     */
    @GET('/:id')
    @Auth()
    async getUserById(context: MiddlewareContext) {
        try {
            const { id } = this.getPathParams(context, '/users/:id');
            this.logger.info('Context params:', context.params);


            if (!id) {
                this.sendError(context, 'User ID is required', 400);
                return;
            }

            const user = await this.userService.getUserById(parseInt(id));

            if (!user) {
                this.sendError(context, `User with ID ${id} not found`, 404);
                return;
            }

            this.logger.info(`Retrieved user: ${id}`);

            this.sendSuccess(context, { user });
        } catch (error) {
            this.logger.error('Error retrieving user:', error);
            this.sendError(context, 'Failed to retrieve user', 500);
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
            const { id } = this.getPathParams(context, '/users/:id');

            if (!id) {
                this.sendError(context, 'User ID is required', 400);
                return;
            }

            const updateData = await this.getRequestBody(context);
            const user = await this.userService.updateUser(parseInt(id), updateData);

            if (!user) {
                this.sendError(context, `User with ID ${id} not found`, 404);
                return;
            }

            this.logger.info(`User updated successfully: ${id}`);

            this.sendSuccess(context, { user }, 'User updated successfully');
        } catch (error) {
            this.logger.error('Error updating user:', error);
            this.sendError(context, 'Failed to update user', 500);
        }
    }

    /**
     * Delete user
     */
    @DELETE('/:id')
    @Auth(['admin'])
    async deleteUser(context: MiddlewareContext) {
        try {
            const { id } = this.getPathParams(context, '/users/:id');

            if (!id) {
                this.sendError(context, 'User ID is required', 400);
                return;
            }

            const deleted = await this.userService.deleteUser(parseInt(id));

            if (!deleted) {
                this.sendError(context, `User with ID ${id} not found`, 404);
                return;
            }

            this.logger.info(`User deleted successfully: ${id}`);

            this.sendSuccess(context, {}, 'User deleted successfully');
        } catch (error) {
            this.logger.error('Error deleting user:', error);
            this.sendError(context, 'Failed to delete user', 500);
        }
    }
}

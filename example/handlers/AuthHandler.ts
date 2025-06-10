import { Route, GET, POST, Auth, Validate } from '../../src/core/RouteDecorators';
import { HttpHandler } from '../../src/core/HttpHandler';
import { UWebSocketWrapper } from '../../src/core/ServerWrapper';
import { Logger } from '../../src/utils/logger';
import { ErrorHandler } from '../../src/utils/errorHandler';
import { JWTManager } from '../../src/auth/jwtManager';
import { HttpRequest, HttpResponse, EnhancedHttpRequest } from '../../src/types/uws-types';
import { Controller } from '../../src/core/AutoRegistration';

// Validation schemas
export const LoginSchema = {
    type: 'object',
    required: ['email', 'password'],
    properties: {
        email: { type: 'string', format: 'email' },
        password: { type: 'string', minLength: 6 }
    }
};

export const RegisterSchema = {
    type: 'object',
    required: ['email', 'password', 'name'],
    properties: {
        email: { type: 'string', format: 'email' },
        password: { type: 'string', minLength: 6 },
        name: { type: 'string', minLength: 2 }
    }
};

export const RefreshTokenSchema = {
    type: 'object',
    required: ['refreshToken'],
    properties: {
        refreshToken: { type: 'string' }
    }
};

/**
 * Authentication handler using modern decorator system
 */
@Controller('AuthHandler') // ← Auto-registration as controller
@Route('/auth')
export class AuthHandler extends HttpHandler {
    private jwtManager: JWTManager;

    constructor(
        server: UWebSocketWrapper,
        logger: Logger,
        errorHandler: ErrorHandler,
        jwtManager: JWTManager
    ) {
        super(server, logger, errorHandler);
        this.jwtManager = jwtManager;
    }

    /**
     * Handle user login
     */
    @POST('/login')
    @Validate(LoginSchema)
    async login(req: HttpRequest | EnhancedHttpRequest, res: HttpResponse) {
        const requestBody = this.getRequestBody(req, res);
        const { email, password } = requestBody || {};
        
        this.logger.info(`Login attempt for email: ${email}`);
        
        // Here you would validate credentials against your database
        // This is just an example - in a real app, verify password hash
        if (!email || !password) {
            throw new Error('Email and password are required');
        }
        
        // Generate tokens
        // Determine role based on email for demo purposes
        const role = email.includes('admin') ? 'admin' : email.includes('moderator') ? 'moderator' : 'user';
        
        const accessToken = this.jwtManager.generateToken({ 
            userId: '1', 
            email,
            role
        });
        
        // For refresh token, we'll use a different approach
        // In a real app, you might store refresh tokens in a database
        const refreshTokenPayload = { 
            userId: '1', 
            email,
            role: 'refresh' // Using role field to indicate token type
        };
        const refreshToken = this.jwtManager.generateToken(refreshTokenPayload);
        
        this.logger.info(`Login successful for email: ${email}`);
        
        return {
            success: true,
            data: { 
                accessToken,
                refreshToken,
                user: {
                    id: '1',
                    email,
                    role
                }
            },
            message: 'Login successful'
        };
    }

    /**
     * Handle user registration
     */
    @POST('/register')
    @Validate(RegisterSchema)
    async register(req: HttpRequest | EnhancedHttpRequest, res: HttpResponse) {
        const requestBody = this.getRequestBody(req, res);
        const { email, password, name } = requestBody || {};
        
        this.logger.info(`Registration attempt for email: ${email}`);
        
        // Here you would validate credentials and check if user already exists
        // This is just an example - in a real app, hash password and save to database
        if (!email || !password || !name) {
            throw new Error('Email, password, and name are required');
        }
        
        // Generate tokens for the new user
        const accessToken = this.jwtManager.generateToken({ 
            userId: '2', 
            email,
            role: 'user'
        });
        
        const refreshTokenPayload = { 
            userId: '2', 
            email,
            role: 'refresh'
        };
        const refreshToken = this.jwtManager.generateToken(refreshTokenPayload);
        
        this.logger.info(`Registration successful for email: ${email}`);
        
        return {
            success: true,
            data: { 
                accessToken,
                refreshToken,
                user: {
                    id: '2',
                    email,
                    name,
                    role: 'user'
                }
            },
            message: 'Registration successful'
        };
    }

    /**
     * Refresh access token
     */
    @POST('/refresh')
    @Validate(RefreshTokenSchema)
    async refreshToken(req: HttpRequest | EnhancedHttpRequest, res: HttpResponse) {
        const requestBody = this.getRequestBody(req, res);
        const { refreshToken } = requestBody || {};
        
        try {
            const decoded = this.jwtManager.verifyToken(refreshToken);
            
            if (decoded.role !== 'refresh') {
                throw new Error('Invalid refresh token');
            }
            
            // Generate new access token
            const newAccessToken = this.jwtManager.generateToken({
                userId: decoded.userId,
                email: decoded.email,
                role: 'user' // Set back to user role for access token
            });
            
            this.logger.info(`Token refreshed for user: ${decoded.userId}`);
            
            return {
                success: true,
                data: { 
                    accessToken: newAccessToken
                },
                message: 'Token refreshed successfully'
            };
        } catch (error) {
            this.logger.error('Token refresh failed:', error);
            throw new Error('Invalid refresh token');
        }
    }

    /**
     * Handle protected route access
     */
    @GET('/protected')
    @Auth()
    async protectedRoute(req: HttpRequest | EnhancedHttpRequest, res: HttpResponse) {
        const user = (req as any).user;
        
        this.logger.info(`Protected route accessed by user: ${user?.userId || 'unknown'}`);
        
        return {
            success: true,
            data: { 
                message: 'Protected route accessed successfully',
                user,
                timestamp: new Date().toISOString()
            }
        };
    }

    /**
     * Logout user (invalidate token)
     */
    @POST('/logout')
    @Auth()
    async logout(req: HttpRequest | EnhancedHttpRequest, res: HttpResponse) {
        const user = (req as any).user;
        
        // In a real application, you would add the token to a blacklist
        // or remove it from a token store
        
        this.logger.info(`User logged out: ${user?.userId || 'unknown'}`);
        
        return {
            success: true,
            message: 'Logged out successfully'
        };
    }

    /**
     * Get current user info
     */
    @GET('/me')
    @Auth()
    async getCurrentUser(req: HttpRequest | EnhancedHttpRequest, res: HttpResponse) {
        const user = (req as any).user;
        
        this.logger.info(`User info requested: ${user?.userId || 'unknown'}`);
        
        return {
            success: true,
            data: {
                user: {
                    id: user?.userId,
                    email: user?.email,
                    role: user?.role || 'user'
                }
            }
        };
    }

    /**
     * Admin-only route example
     */
    @GET('/admin')
    @Auth(['admin'])
    async adminRoute(req: HttpRequest | EnhancedHttpRequest, res: HttpResponse) {
        const user = (req as any).user;
        
        this.logger.info(`Admin route accessed by: ${user?.userId || 'unknown'}`);
        
        return {
            success: true,
            data: {
                message: 'Admin route accessed successfully',
                user,
                adminData: {
                    systemStatus: 'healthy',
                    activeUsers: 42,
                    systemUptime: process.uptime()
                }
            }
        };
    }

    /**
     * Legacy method - routes are now automatically registered via decorators
     */
    registerRoutes(): void {
        this.logger.info('AuthHandler routes are automatically registered via decorators');
    }
}

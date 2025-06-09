import { BaseHandler } from '../../src/core/BaseHandler';
import { UWebSocketWrapper } from '../../src/core/uWebSocketWrapper';
import { Logger } from '../../src/utils/logger';
import { ErrorHandler } from '../../src/utils/errorHandler';
import { JWTManager } from '../../src/auth/jwtManager';

/**
 * Authentication handler
 */
export class AuthHandler extends BaseHandler {
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

    registerRoutes(): void {
        this.server.addHttpHandler('post', '/auth/login', (req, res) => 
            this.handleAsync(req, res, this.login.bind(this), 'Login')
        );

        this.server.addHttpHandler('get', '/protected', (req, res) => 
            this.handleAsync(req, res, this.protectedRoute.bind(this), 'Protected Route')
        , true); // Requires authentication
    }

    /**
     * Handle user login
     */
    private async login(req: any, res: any): Promise<void> {
        const { email } = await this.parseJsonBody(res);
        
        // Here you would validate credentials against your database
        // This is just an example
        const token = this.jwtManager.generateToken({ userId: '1', email });
        
        this.sendSuccess(res, { token }, 'Login successful');
    }

    /**
     * Handle protected route access
     */
    private async protectedRoute(req: any, res: any): Promise<void> {
        const user = (req as any).user;
        this.sendSuccess(res, { message: 'Protected route accessed', user });
    }
}

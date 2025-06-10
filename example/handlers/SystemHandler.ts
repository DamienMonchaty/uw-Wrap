import { Route, GET, POST, Auth } from '../../src/core/RouteDecorators';
import { HttpHandler } from '../../src/core/HttpHandler';
import { UWebSocketWrapper } from '../../src/core/ServerWrapper';
import { Logger } from '../../src/utils/logger';
import { ErrorHandler } from '../../src/utils/errorHandler';
import { Controller } from '../../src/core/AutoRegistration';

/**
 * System handler for health checks and system information using modern decorator system
 */
@Controller('SystemHandler') // ← Auto-registration as controller
@Route('/system')
export class SystemHandler extends HttpHandler {
    constructor(
        server: UWebSocketWrapper,
        logger: Logger,
        errorHandler: ErrorHandler
    ) {
        super(server, logger, errorHandler);
        this.setupWebSocketHandlers();
    }

    /**
     * Health check endpoint - no authentication required
     */
    @GET('/health')
    async healthCheck(req: any, res: any) {
        // Only log health checks in development
        if (process.env.NODE_ENV === 'development') {
            this.logger.info('Health check requested');
        }
        
        const healthData = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch
        };
        
        return {
            success: true,
            data: healthData
        };
    }

    /**
     * System information endpoint - requires authentication
     */
    @GET('/info')
    @Auth()
    async systemInfo(req: any, res: any) {
        // Only log in development mode
        if (process.env.NODE_ENV === 'development') {
            this.logger.info('System info requested');
        }
        
        const systemData = {
            name: 'uW-Wrap Server',
            version: '1.0.0',
            node: process.version,
            platform: process.platform,
            arch: process.arch,
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development',
            pid: process.pid,
            memory: {
                ...process.memoryUsage(),
                free: require('os').freemem(),
                total: require('os').totalmem()
            },
            cpus: require('os').cpus().length,
            loadavg: require('os').loadavg()
        };
        
        return {
            success: true,
            data: systemData
        };
    }

    /**
     * Detailed system metrics - admin only
     */
    @GET('/metrics')
    @Auth(['admin'])
    async systemMetrics(req: any, res: any) {
        // Only log in development mode
        if (process.env.NODE_ENV === 'development') {
            this.logger.info('System metrics requested');
        }
        
        const metrics = {
            timestamp: new Date().toISOString(),
            process: {
                pid: process.pid,
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                cpu: process.cpuUsage(),
                version: process.version,
                versions: process.versions
            },
            system: {
                platform: process.platform,
                arch: process.arch,
                hostname: require('os').hostname(),
                type: require('os').type(),
                release: require('os').release(),
                uptime: require('os').uptime(),
                loadavg: require('os').loadavg(),
                totalmem: require('os').totalmem(),
                freemem: require('os').freemem(),
                cpus: require('os').cpus()
            }
        };
        
        return {
            success: true,
            data: metrics
        };
    }

    /**
     * Server status endpoint
     */
    @GET('/status')
    async serverStatus(req: any, res: any) {
        // Only log in development mode
        if (process.env.NODE_ENV === 'development') {
            this.logger.info('Server status requested');
        }
        
        const status = {
            server: 'running',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            version: '1.0.0',
            environment: process.env.NODE_ENV || 'development'
        };
        
        return {
            success: true,
            data: status
        };
    }

    /**
     * Restart server - admin only
     */
    @POST('/restart')
    @Auth(['admin'])
    async restartServer(req: any, res: any) {
        this.logger.info('Server restart requested');
        
        // In a real application, you would implement graceful shutdown
        // and restart logic here
        
        return {
            success: true,
            message: 'Server restart initiated (mock)',
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Setup WebSocket handlers (non-decorator based as they use different pattern)
     */
    private setupWebSocketHandlers(): void {
        this.server.addWebSocketHandler('/ws', {
            onMessage: (ws, message, flags) => {
                try {
                    const data = JSON.parse(Buffer.from(message).toString());
                    this.logger.info('WebSocket message received', { data });
                    
                    // Echo the message back with enhanced info
                    ws.send(JSON.stringify({
                        type: 'echo',
                        data: data,
                        timestamp: new Date().toISOString(),
                        server: 'uW-Wrap',
                        decoratorSystem: 'active'
                    }));
                } catch (error) {
                    this.logger.error('WebSocket message error:', error);
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: 'Invalid JSON message',
                        timestamp: new Date().toISOString()
                    }));
                }
            },
            onOpen: (ws) => {
                this.logger.info('WebSocket connection opened');
                ws.send(JSON.stringify({
                    type: 'welcome',
                    message: 'Connected to uW-Wrap WebSocket server',
                    server: 'uW-Wrap v1.0.0',
                    decoratorSystem: 'active',
                    timestamp: new Date().toISOString()
                }));
            },
            onClose: (ws, code, reason) => {
                this.logger.info('WebSocket connection closed', { code, reason });
            }
        });
    }

    /**
     * Legacy method - routes are now automatically registered via decorators
     */
    registerRoutes(): void {
        this.logger.info('SystemHandler routes are automatically registered via decorators');
        // WebSocket handlers are set up in setupWebSocketHandlers()
    }
}

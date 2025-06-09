import { BaseHandler } from '../../src/core/BaseHandler';
import { UWebSocketWrapper } from '../../src/core/uWebSocketWrapper';
import { Logger } from '../../src/utils/logger';
import { ErrorHandler } from '../../src/utils/errorHandler';

/**
 * System handler for health checks and system information
 */
export class SystemHandler extends BaseHandler {
    constructor(
        server: UWebSocketWrapper,
        logger: Logger,
        errorHandler: ErrorHandler
    ) {
        super(server, logger, errorHandler);
    }

    registerRoutes(): void {
        this.server.addHttpHandler('get', '/health', (req, res) => 
            this.handleAsync(req, res, this.healthCheck.bind(this), 'Health Check')
        );

        this.server.addHttpHandler('get', '/info', (req, res) => 
            this.handleAsync(req, res, this.systemInfo.bind(this), 'System Info')
        );

        // WebSocket handler
        this.server.addWebSocketHandler('/ws', {
            onMessage: (ws, message, flags) => {
                try {
                    const data = JSON.parse(Buffer.from(message).toString());
                    this.logger.info('WebSocket message received', { data });
                    
                    // Echo the message back
                    ws.send(JSON.stringify({
                        type: 'echo',
                        data: data,
                        timestamp: new Date().toISOString()
                    }));
                } catch (error) {
                    this.logger.error('WebSocket message error:', error);
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: 'Invalid JSON message'
                    }));
                }
            },
            onOpen: (ws) => {
                this.logger.info('WebSocket connection opened');
                ws.send(JSON.stringify({
                    type: 'welcome',
                    message: 'Connected to uW-Wrap WebSocket server'
                }));
            },
            onClose: (ws, code, reason) => {
                this.logger.info('WebSocket connection closed', { code, reason });
            }
        });
    }

    /**
     * Health check endpoint
     */
    private async healthCheck(req: any, res: any): Promise<void> {
        this.sendSuccess(res, { 
            status: 'healthy', 
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: process.memoryUsage()
        });
    }

    /**
     * System information endpoint
     */
    private async systemInfo(req: any, res: any): Promise<void> {
        this.sendSuccess(res, {
            name: 'uW-Wrap Server',
            version: '1.0.0',
            node: process.version,
            platform: process.platform,
            arch: process.arch,
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
        });
    }
}

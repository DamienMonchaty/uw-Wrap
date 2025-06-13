/**
 * UWebSocketWrapper - Refactored with SOLID principles
 * Single Responsibility: uWebSockets.js app configuration and route registration
 */

import * as uWS from 'uWebSockets.js';
import { HttpHandler, WebSocketHandler } from '../types';
import { Logger } from '../utils/logger';
import { ErrorHandler } from '../utils/errorHandler';
import { JWTManager } from '../auth/jwtManager';

// Import specialized managers
import { ServerEventManager, ServerEventType } from './server/ServerEventManager';
import { HttpHandlerWrapper, HandlerWrapperOptions } from './server/HttpHandlerWrapper';
import { AuthenticationWrapper, AuthenticationOptions } from './server/AuthenticationWrapper';
import { ResponseManager, ResponseOptions } from './server/ResponseManager';
import { RequestManager, RequestManagerOptions } from './server/RequestManager';

export interface UWebSocketWrapperOptions {
    /** Handler wrapper options */
    handlerOptions?: HandlerWrapperOptions;
    /** Authentication options */
    authOptions?: AuthenticationOptions;
    /** Response manager options */
    responseOptions?: ResponseOptions;
    /** Request manager options */
    requestOptions?: RequestManagerOptions;
    /** Enable server events */
    enableEvents?: boolean;
}

/**
 * UWebSocket Wrapper - Refactored with Single Responsibility Principle
 * Now delegates specific responsibilities to specialized managers
 */
export class UWebSocketWrapper {
    private port: number;
    private app: uWS.TemplatedApp;
    private logger: Logger;
    private errorHandler: ErrorHandler;
    private jwtManager?: JWTManager;

    // Specialized managers
    private eventManager?: ServerEventManager;
    private handlerWrapper!: HttpHandlerWrapper;
    private authWrapper?: AuthenticationWrapper;
    private responseManager!: ResponseManager;
    private requestManager!: RequestManager;

    // Server state
    private isStarted = false;
    private listenSocket?: uWS.us_listen_socket;

    constructor(
        port: number, 
        logger: Logger, 
        errorHandler: ErrorHandler, 
        jwtManager?: JWTManager,
        options: UWebSocketWrapperOptions = {}
    ) {
        this.port = port;
        this.app = uWS.App();
        this.logger = logger;
        this.errorHandler = errorHandler;
        this.jwtManager = jwtManager;

        // Initialize specialized managers
        this.initializeManagers(options);
    }

    /**
     * Initialize specialized managers
     */
    private initializeManagers(options: UWebSocketWrapperOptions): void {
        // Event manager (optional)
        if (options.enableEvents !== false) {
            this.eventManager = new ServerEventManager(this.logger, this.errorHandler);
        }

        // Handler wrapper
        this.handlerWrapper = new HttpHandlerWrapper(
            this.logger, 
            this.errorHandler, 
            options.handlerOptions
        );

        // Authentication wrapper (if JWT manager available)
        if (this.jwtManager) {
            this.authWrapper = new AuthenticationWrapper(
                this.jwtManager,
                this.logger,
                this.errorHandler,
                options.authOptions
            );
        }

        // Response manager
        this.responseManager = new ResponseManager(this.logger, options.responseOptions);

        // Request manager
        this.requestManager = new RequestManager(this.logger, options.requestOptions);
    }

    /**
     * Start the server
     */
    async start(): Promise<void> {
        if (this.isStarted) {
            this.logger.warn('Server is already started');
            return;
        }

        await this.eventManager?.emit('starting', { port: this.port });

        return new Promise((resolve, reject) => {
            this.app.listen(this.port, (token: uWS.us_listen_socket | false) => {
                if (token) {
                    this.listenSocket = token;
                    this.isStarted = true;
                    
                    this.logger.info(`🚀 Server running on port ${this.port}`);
                    this.eventManager?.emit('started', { port: this.port });
                    
                    resolve();
                } else {
                    const error = new Error('Failed to start server');
                    this.logger.error('Failed to start server', { port: this.port });
                    this.eventManager?.emit('error', { error: error.message, port: this.port });
                    
                    reject(error);
                }
            });
        });
    }

    /**
     * Stop the server
     */
    async stop(): Promise<void> {
        if (!this.isStarted) {
            this.logger.warn('Server is not started');
            return;
        }

        await this.eventManager?.emit('stopping', { port: this.port });

        try {
            if (this.listenSocket) {
                uWS.us_listen_socket_close(this.listenSocket);
                this.listenSocket = undefined;
            }

            this.isStarted = false;
            this.logger.info(`🛑 Server stopped on port ${this.port}`);
            await this.eventManager?.emit('stopped', { port: this.port });

        } catch (error) {
            this.logger.error('Error stopping server:', error);
            await this.eventManager?.emit('error', { error: (error as Error).message });
            throw error;
        }
    }

    /**
     * Add HTTP handler with automatic wrapping
     */
    addHttpHandler(
        method: 'get' | 'post' | 'put' | 'delete', 
        route: string, 
        handler: HttpHandler, 
        requireAuth: boolean = false
    ): void {
        // Apply authentication if required
        let finalHandler = handler;
        
        if (requireAuth && this.authWrapper) {
            finalHandler = this.authWrapper.requireAuth(handler);
        }

        // Wrap handler with common functionality
        const wrappedHandler = this.handlerWrapper.wrapHandler(finalHandler);

        // Create uWS adapter (swaps req/res order)
        const uwsHandler = (res: uWS.HttpResponse, req: uWS.HttpRequest) => {
            wrappedHandler(req, res);
        };

        // Register with uWebSockets
        switch (method) {
            case 'get':
                this.app.get(route, uwsHandler);
                break;
            case 'post':
                this.app.post(route, uwsHandler);
                break;
            case 'put':
                this.app.put(route, uwsHandler);
                break;
            case 'delete':
                this.app.del(route, uwsHandler);
                break;
        }

        this.logger.debug(`Registered ${method.toUpperCase()} ${route}`, { requireAuth });
    }

    /**
     * Add HTTP handler with optional authentication
     */
    addHttpHandlerWithOptionalAuth(
        method: 'get' | 'post' | 'put' | 'delete',
        route: string,
        handler: HttpHandler
    ): void {
        let finalHandler = handler;

        // Apply optional authentication if available
        if (this.authWrapper) {
            finalHandler = this.authWrapper.optionalAuth(handler);
        }

        // Use existing method but with no required auth
        this.addHttpHandler(method, route, finalHandler, false);
    }

    /**
     * Add WebSocket handler
     */
    addWebSocketHandler<UserData = any>(
        route: string,
        handler: WebSocketHandler,
        options: Partial<uWS.WebSocketBehavior<UserData>> = {}
    ): void {
        this.app.ws<UserData>(route, {
            ...options,
            open: (ws: uWS.WebSocket<UserData>) => {
                try {
                    if (handler.onOpen) {
                        handler.onOpen(ws);
                    }
                } catch (error) {
                    this.errorHandler.handleError(error as Error, 'WebSocket Open');
                    ws.close();
                }
            },
            message: (ws: uWS.WebSocket<UserData>, message: ArrayBuffer, isBinary: boolean) => {
                try {
                    if (handler.onMessage) {
                        const msg = Buffer.from(message);
                        handler.onMessage(ws, msg, { binary: isBinary });
                    }
                } catch (error) {
                    this.errorHandler.handleError(error as Error, 'WebSocket Message');
                    ws.close();
                }
            },
            close: (ws: uWS.WebSocket<UserData>, code: number, message: ArrayBuffer) => {
                try {
                    if (handler.onClose) {
                        const msg = Buffer.from(message).toString();
                        handler.onClose(ws, code, msg);
                    }
                } catch (error) {
                    this.errorHandler.handleError(error as Error, 'WebSocket Close');
                }
            },
        });

        this.logger.debug(`Registered WebSocket ${route}`);
    }

    // ============================================================================
    // DELEGATED METHODS - Forward to specialized managers
    // ============================================================================

    /**
     * Send JSON response (delegates to ResponseManager)
     */
    sendJSON(res: uWS.HttpResponse, data: any, statusCode: number = 200): void {
        this.responseManager.sendJSON(res, data, { statusCode });
    }

    /**
     * Read request body (delegates to RequestManager)
     */
    readBody(res: uWS.HttpResponse): Promise<string> {
        return this.requestManager.readBody(res);
    }

    /**
     * Parse request body (delegates to RequestManager)
     */
    async parseBody(res: uWS.HttpResponse, req: uWS.HttpRequest) {
        return this.requestManager.parseBody(res, req);
    }

    /**
     * Get query parameters (delegates to RequestManager)
     */
    getQueryParams(req: uWS.HttpRequest): Record<string, string> {
        return this.requestManager.getQueryParams(req);
    }

    /**
     * Get request headers (delegates to RequestManager)
     */
    getHeaders(req: uWS.HttpRequest): Record<string, string> {
        return this.requestManager.getHeaders(req);
    }

    /**
     * Get client IP (delegates to RequestManager)
     */
    getClientIP(req: uWS.HttpRequest): string {
        return this.requestManager.getClientIP(req);
    }

    // ============================================================================
    // EVENT MANAGEMENT
    // ============================================================================

    /**
     * Add server event listener
     */
    on(eventType: ServerEventType, handler: (event: ServerEventType, data?: any) => void | Promise<void>): void {
        this.eventManager?.on(eventType, handler);
    }

    /**
     * Remove server event listener
     */
    off(eventType: ServerEventType, handler: (event: ServerEventType, data?: any) => void | Promise<void>): void {
        this.eventManager?.off(eventType, handler);
    }

    // ============================================================================
    // GETTERS AND STATUS
    // ============================================================================

    /**
     * Check if server is started
     */
    isServerStarted(): boolean {
        return this.isStarted;
    }

    /**
     * Get server port
     */
    getPort(): number {
        return this.port;
    }

    /**
     * Get response manager (for advanced usage)
     */
    getResponseManager(): ResponseManager {
        return this.responseManager;
    }

    /**
     * Get request manager (for advanced usage)
     */
    getRequestManager(): RequestManager {
        return this.requestManager;
    }

    /**
     * Get handler wrapper (for configuration)
     */
    getHandlerWrapper(): HttpHandlerWrapper {
        return this.handlerWrapper;
    }

    /**
     * Get authentication wrapper (if available)
     */
    getAuthWrapper(): AuthenticationWrapper | undefined {
        return this.authWrapper;
    }

    /**
     * Get event manager (if available)
     */
    getEventManager(): ServerEventManager | undefined {
        return this.eventManager;
    }
}

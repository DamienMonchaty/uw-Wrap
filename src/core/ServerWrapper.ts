import * as uWS from 'uWebSockets.js';
import { HttpHandler, WebSocketHandler } from '../types';
import { Logger } from '../utils/logger';
import { ErrorHandler, AppError } from '../utils/errorHandler';
import { JWTManager } from '../auth/jwtManager';

export class UWebSocketWrapper {
    private port: number;
    private app: uWS.TemplatedApp;
    private logger: Logger;
    private errorHandler: ErrorHandler;
    private jwtManager?: JWTManager;

    constructor(port: number, logger: Logger, errorHandler: ErrorHandler, jwtManager?: JWTManager) {
        this.port = port;
        this.app = uWS.App();
        this.logger = logger;
        this.errorHandler = errorHandler;
        this.jwtManager = jwtManager;
    }

    start(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.app.listen(this.port, (token: any) => {
                if (token) {
                    this.logger.info(`🚀 Server running on port ${this.port}`);
                    resolve();
                } else {
                    const error = new Error('Failed to start server');
                    this.logger.error('Failed to start server', { port: this.port });
                    reject(error);
                }
            });
        });
    }

    private wrapHandler(handler: HttpHandler): HttpHandler {
        return (req: uWS.HttpRequest, res: uWS.HttpResponse) => {
            let hasResponded = false;
            
            // Add a flag to prevent multiple responses
            res.onAborted(() => {
                hasResponded = true;
            });

            try {
                const result = handler(req, res);
                
                // If handler returns a promise, handle it properly
                if (result && typeof result === 'object' && typeof result.then === 'function') {
                    (result as Promise<void>).catch((error: Error) => {
                        if (!hasResponded) {
                            hasResponded = true;
                            const { response: errorResponse, statusCode } = this.errorHandler.handleError(error, 'Async HTTP Handler');
                            this.sendJSON(res, errorResponse, statusCode);
                        }
                    });
                }
            } catch (error) {
                if (!hasResponded) {
                    hasResponded = true;
                    const { response: errorResponse, statusCode } = this.errorHandler.handleError(error as Error, 'HTTP Handler');
                    this.sendJSON(res, errorResponse, statusCode);
                }
            }
        };
    }

    private requireAuth(handler: HttpHandler): HttpHandler {
        return (req: uWS.HttpRequest, res: uWS.HttpResponse) => {
            try {
                if (!this.jwtManager) {
                    throw this.errorHandler.createAuthenticationError('JWT not configured');
                }

                const authHeader = req.getHeader('authorization');
                if (!authHeader) {
                    throw this.errorHandler.createAuthenticationError('No authorization header');
                }

                const token = this.jwtManager.extractTokenFromHeader(authHeader);
                const payload = this.jwtManager.verifyToken(token);
                
                // Add user info to request context (you might want to extend this)
                (req as any).user = payload;
                
                handler(req, res);
            } catch (error) {
                const { response: errorResponse, statusCode } = this.errorHandler.handleError(error as Error, 'Auth Middleware');
                res.cork(() => {
                    res.writeStatus(`${statusCode} ${statusCode === 401 ? 'Unauthorized' : 'Internal Server Error'}`);
                    res.writeHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify(errorResponse));
                });
            }
        };
    }

    addHttpHandler(method: 'get' | 'post' | 'put' | 'delete', route: string, handler: HttpHandler, requireAuth: boolean = false): void {
        const wrappedHandler = this.wrapHandler(requireAuth && this.jwtManager ? this.requireAuth(handler) : handler);

        // Adapter to swap (req, res) -> (res, req)
        const uwsHandler = (res: uWS.HttpResponse, req: uWS.HttpRequest) => {
            wrappedHandler(req, res);
        };

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
    }

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
                        // Convert ArrayBuffer to Buffer for compatibility
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
                        // Convert ArrayBuffer to string for compatibility
                        const msg = Buffer.from(message).toString();
                        handler.onClose(ws, code, msg);
                    }
                } catch (error) {
                    this.errorHandler.handleError(error as Error, 'WebSocket Close');
                }
            },
        });
    }

    // Helper method to send JSON responses
    sendJSON(res: uWS.HttpResponse, data: any, statusCode: number = 200): void {
        // Check if response is still valid before sending
        if (res.aborted) {
            return; // Don't try to send if response is aborted
        }
        
        try {
            res.cork(() => {
                if (!res.aborted) {
                    res.writeStatus(`${statusCode}`);
                    res.writeHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify(data));
                }
            });
        } catch (error) {
            // Log the error but don't throw - response might be closed
            this.logger.warn('Failed to send JSON response:', { error: (error as Error).message, statusCode });
        }
    }

    // Helper method to read request body
    readBody(res: uWS.HttpResponse): Promise<string> {
        return new Promise((resolve, reject) => {
            let buffer = '';
            let aborted = false;
            
            res.onAborted(() => {
                aborted = true;
                reject(new Error('Request aborted'));
            });
            
            res.onData((chunk, isLast) => {
                if (aborted) return;
                
                try {
                    buffer += Buffer.from(chunk).toString();
                    if (isLast) {
                        resolve(buffer);
                    }
                } catch (error) {
                    reject(new Error('Failed to read request body: ' + (error as Error).message));
                }
            });
        });
    }
}

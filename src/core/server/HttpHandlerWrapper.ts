/**
 * HttpHandlerWrapper - Manages HTTP handler wrapping and middleware
 * Single Responsibility: HTTP request/response processing
 */

import * as uWS from 'uWebSockets.js';
import { HttpHandler } from '../../types';
import { Logger } from '../../utils/logger';
import { ErrorHandler } from '../../utils/errorHandler';

export interface HandlerWrapperOptions {
    /** Enable request timeout */
    enableTimeout?: boolean;
    /** Request timeout in milliseconds */
    timeoutMs?: number;
    /** Enable request logging */
    enableLogging?: boolean;
    /** Enable error catching */
    enableErrorCatching?: boolean;
}

/**
 * HTTP Handler Wrapper - Manages request/response lifecycle
 */
export class HttpHandlerWrapper {
    private logger: Logger;
    private errorHandler: ErrorHandler;
    private options: HandlerWrapperOptions;

    constructor(
        logger: Logger,
        errorHandler: ErrorHandler,
        options: HandlerWrapperOptions = {}
    ) {
        this.logger = logger;
        this.errorHandler = errorHandler;
        this.options = {
            enableTimeout: true,
            timeoutMs: 30000,
            enableLogging: false,
            enableErrorCatching: true,
            ...options
        };
    }

    /**
     * Wrap an HTTP handler with common functionality
     */
    wrapHandler(handler: HttpHandler): HttpHandler {
        return (req: uWS.HttpRequest, res: uWS.HttpResponse) => {
            let hasResponded = false;
            let timeoutHandle: NodeJS.Timeout | null = null;

            // Set up request timeout
            if (this.options.enableTimeout) {
                timeoutHandle = setTimeout(() => {
                    if (!hasResponded) {
                        hasResponded = true;
                        this.sendTimeoutResponse(res);
                    }
                }, this.options.timeoutMs);
            }

            // Handle response abortion
            res.onAborted(() => {
                hasResponded = true;
                if (timeoutHandle) {
                    clearTimeout(timeoutHandle);
                }
                
                if (this.options.enableLogging) {
                    this.logger.warn('Request aborted', {
                        url: req.getUrl(),
                        method: req.getMethod()
                    });
                }
            });

            // Log request if enabled
            if (this.options.enableLogging) {
                this.logger.debug('Incoming request', {
                    method: req.getMethod(),
                    url: req.getUrl(),
                    userAgent: req.getHeader('user-agent')
                });
            }

            try {
                const result = handler(req, res);

                // Handle async handlers
                if (result && typeof result === 'object' && typeof result.then === 'function') {
                    (result as Promise<void>)
                        .then(() => {
                            if (timeoutHandle) {
                                clearTimeout(timeoutHandle);
                            }
                        })
                        .catch((error: Error) => {
                            if (timeoutHandle) {
                                clearTimeout(timeoutHandle);
                            }
                            
                            if (!hasResponded && this.options.enableErrorCatching) {
                                hasResponded = true;
                                this.sendErrorResponse(res, error, 'Async HTTP Handler');
                            }
                        });
                } else {
                    // Sync handler completed
                    if (timeoutHandle) {
                        clearTimeout(timeoutHandle);
                    }
                }

            } catch (error) {
                if (timeoutHandle) {
                    clearTimeout(timeoutHandle);
                }

                if (!hasResponded && this.options.enableErrorCatching) {
                    hasResponded = true;
                    this.sendErrorResponse(res, error as Error, 'HTTP Handler');
                }
            }
        };
    }

    /**
     * Send timeout response
     */
    private sendTimeoutResponse(res: uWS.HttpResponse): void {
        if (res.aborted) return;

        try {
            res.cork(() => {
                if (!res.aborted) {
                    res.writeStatus('408 Request Timeout');
                    res.writeHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({
                        error: 'Request Timeout',
                        message: 'Request took too long to process',
                        statusCode: 408
                    }));
                }
            });
        } catch (error) {
            this.logger.warn('Failed to send timeout response:', error);
        }
    }

    /**
     * Send error response
     */
    private sendErrorResponse(res: uWS.HttpResponse, error: Error, context: string): void {
        if (res.aborted) return;

        try {
            const { response: errorResponse, statusCode } = this.errorHandler.handleError(error, context);
            
            res.cork(() => {
                if (!res.aborted) {
                    res.writeStatus(`${statusCode}`);
                    res.writeHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify(errorResponse));
                }
            });
        } catch (sendError) {
            this.logger.warn('Failed to send error response:', sendError);
        }
    }

    /**
     * Update wrapper options
     */
    updateOptions(newOptions: Partial<HandlerWrapperOptions>): void {
        this.options = { ...this.options, ...newOptions };
    }

    /**
     * Get current options
     */
    getOptions(): HandlerWrapperOptions {
        return { ...this.options };
    }
}

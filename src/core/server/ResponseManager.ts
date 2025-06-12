/**
 * ResponseManager - Manages HTTP responses and utilities
 * Single Responsibility: Response creation and sending
 */

import * as uWS from 'uWebSockets.js';
import { Logger } from '../../utils/logger';

export interface ResponseOptions {
    /** Enable response compression */
    enableCompression?: boolean;
    /** Default response headers */
    defaultHeaders?: Record<string, string>;
    /** Enable response logging */
    enableLogging?: boolean;
}

export interface JsonResponseOptions {
    statusCode?: number;
    headers?: Record<string, string>;
    pretty?: boolean;
}

/**
 * Response Manager - Handles HTTP response creation and sending
 */
export class ResponseManager {
    private logger: Logger;
    private options: ResponseOptions;

    constructor(logger: Logger, options: ResponseOptions = {}) {
        this.logger = logger;
        this.options = {
            enableCompression: false,
            defaultHeaders: {
                'X-Powered-By': 'uW-Wrap',
                'Cache-Control': 'no-cache'
            },
            enableLogging: false,
            ...options
        };
    }

    /**
     * Send JSON response
     */
    sendJSON(
        res: uWS.HttpResponse, 
        data: any, 
        options: JsonResponseOptions = {}
    ): void {
        if (res.aborted) {
            if (this.options.enableLogging) {
                this.logger.warn('Attempted to send JSON to aborted response');
            }
            return;
        }

        const {
            statusCode = 200,
            headers = {},
            pretty = false
        } = options;

        try {
            const jsonString = pretty 
                ? JSON.stringify(data, null, 2)
                : JSON.stringify(data);

            res.cork(() => {
                if (!res.aborted) {
                    // Set status
                    res.writeStatus(`${statusCode}`);
                    
                    // Set default headers
                    for (const [key, value] of Object.entries(this.options.defaultHeaders || {})) {
                        res.writeHeader(key, value);
                    }
                    
                    // Set content type
                    res.writeHeader('Content-Type', 'application/json; charset=utf-8');
                    
                    // Set custom headers
                    for (const [key, value] of Object.entries(headers)) {
                        res.writeHeader(key, value);
                    }
                    
                    // Send response
                    res.end(jsonString);
                }
            });

            if (this.options.enableLogging) {
                this.logger.debug('JSON response sent', {
                    statusCode,
                    contentLength: jsonString.length
                });
            }

        } catch (error) {
            this.logger.error('Failed to send JSON response:', error);
            
            // Try to send a basic error response
            this.sendErrorResponse(res, 'Internal Server Error', 500);
        }
    }

    /**
     * Send text response
     */
    sendText(
        res: uWS.HttpResponse,
        text: string,
        statusCode: number = 200,
        headers: Record<string, string> = {}
    ): void {
        if (res.aborted) {
            if (this.options.enableLogging) {
                this.logger.warn('Attempted to send text to aborted response');
            }
            return;
        }

        try {
            res.cork(() => {
                if (!res.aborted) {
                    res.writeStatus(`${statusCode}`);
                    
                    // Default headers
                    for (const [key, value] of Object.entries(this.options.defaultHeaders || {})) {
                        res.writeHeader(key, value);
                    }
                    
                    res.writeHeader('Content-Type', 'text/plain; charset=utf-8');
                    
                    // Custom headers
                    for (const [key, value] of Object.entries(headers)) {
                        res.writeHeader(key, value);
                    }
                    
                    res.end(text);
                }
            });

            if (this.options.enableLogging) {
                this.logger.debug('Text response sent', {
                    statusCode,
                    contentLength: text.length
                });
            }

        } catch (error) {
            this.logger.error('Failed to send text response:', error);
        }
    }

    /**
     * Send HTML response
     */
    sendHTML(
        res: uWS.HttpResponse,
        html: string,
        statusCode: number = 200,
        headers: Record<string, string> = {}
    ): void {
        if (res.aborted) return;

        try {
            res.cork(() => {
                if (!res.aborted) {
                    res.writeStatus(`${statusCode}`);
                    
                    // Default headers
                    for (const [key, value] of Object.entries(this.options.defaultHeaders || {})) {
                        res.writeHeader(key, value);
                    }
                    
                    res.writeHeader('Content-Type', 'text/html; charset=utf-8');
                    
                    // Custom headers
                    for (const [key, value] of Object.entries(headers)) {
                        res.writeHeader(key, value);
                    }
                    
                    res.end(html);
                }
            });
        } catch (error) {
            this.logger.error('Failed to send HTML response:', error);
        }
    }

    /**
     * Send error response
     */
    sendErrorResponse(
        res: uWS.HttpResponse,
        message: string,
        statusCode: number = 500,
        details?: any
    ): void {
        if (res.aborted) return;

        const errorResponse = {
            error: true,
            message,
            statusCode,
            timestamp: new Date().toISOString(),
            ...(details && { details })
        };

        this.sendJSON(res, errorResponse, { statusCode });
    }

    /**
     * Send redirect response
     */
    sendRedirect(
        res: uWS.HttpResponse,
        location: string,
        statusCode: number = 302
    ): void {
        if (res.aborted) return;

        try {
            res.cork(() => {
                if (!res.aborted) {
                    res.writeStatus(`${statusCode}`);
                    res.writeHeader('Location', location);
                    res.end();
                }
            });
        } catch (error) {
            this.logger.error('Failed to send redirect response:', error);
        }
    }

    /**
     * Send no content response
     */
    sendNoContent(res: uWS.HttpResponse): void {
        if (res.aborted) return;

        try {
            res.cork(() => {
                if (!res.aborted) {
                    res.writeStatus('204 No Content');
                    res.end();
                }
            });
        } catch (error) {
            this.logger.error('Failed to send no content response:', error);
        }
    }

    /**
     * Update response manager options
     */
    updateOptions(newOptions: Partial<ResponseOptions>): void {
        this.options = { ...this.options, ...newOptions };
    }

    /**
     * Get current options
     */
    getOptions(): ResponseOptions {
        return { ...this.options };
    }

    /**
     * Add default header
     */
    addDefaultHeader(key: string, value: string): void {
        if (!this.options.defaultHeaders) {
            this.options.defaultHeaders = {};
        }
        this.options.defaultHeaders[key] = value;
    }

    /**
     * Remove default header
     */
    removeDefaultHeader(key: string): void {
        if (this.options.defaultHeaders) {
            delete this.options.defaultHeaders[key];
        }
    }
}

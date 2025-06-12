/**
 * RequestManager - Manages HTTP request processing and body reading
 * Single Responsibility: Request data extraction and processing
 */

import * as uWS from 'uWebSockets.js';
import { Logger } from '../../utils/logger';

export interface RequestManagerOptions {
    /** Maximum body size in bytes */
    maxBodySize?: number;
    /** Request timeout in milliseconds */
    requestTimeoutMs?: number;
    /** Enable request logging */
    enableLogging?: boolean;
    /** Default encoding for text data */
    defaultEncoding?: BufferEncoding;
}

export interface ParsedBody {
    success: boolean;
    data?: any;
    error?: string;
    contentType?: string;
    size: number;
}

/**
 * Request Manager - Handles HTTP request processing
 */
export class RequestManager {
    private logger: Logger;
    private options: RequestManagerOptions;

    constructor(logger: Logger, options: RequestManagerOptions = {}) {
        this.logger = logger;
        this.options = {
            maxBodySize: 1024 * 1024, // 1MB default
            requestTimeoutMs: 30000,
            enableLogging: false,
            defaultEncoding: 'utf8',
            ...options
        };
    }

    /**
     * Read request body as string
     */
    readBody(res: uWS.HttpResponse): Promise<string> {
        return new Promise((resolve, reject) => {
            let buffer = '';
            let aborted = false;
            let totalSize = 0;

            // Set timeout
            const timeoutHandle = setTimeout(() => {
                if (!aborted) {
                    aborted = true;
                    reject(new Error('Request body read timeout'));
                }
            }, this.options.requestTimeoutMs);

            res.onAborted(() => {
                aborted = true;
                clearTimeout(timeoutHandle);
                reject(new Error('Request aborted'));
            });

            res.onData((chunk, isLast) => {
                if (aborted) return;

                try {
                    const chunkSize = chunk.byteLength;
                    totalSize += chunkSize;

                    // Check size limit
                    if (totalSize > this.options.maxBodySize!) {
                        aborted = true;
                        clearTimeout(timeoutHandle);
                        reject(new Error(`Request body too large. Maximum size: ${this.options.maxBodySize} bytes`));
                        return;
                    }

                    // Convert chunk to string
                    const chunkString = Buffer.from(chunk).toString(this.options.defaultEncoding);
                    buffer += chunkString;

                    if (isLast) {
                        clearTimeout(timeoutHandle);
                        
                        if (this.options.enableLogging) {
                            this.logger.debug('Request body read completed', {
                                size: totalSize,
                                encoding: this.options.defaultEncoding
                            });
                        }
                        
                        resolve(buffer);
                    }
                } catch (error) {
                    aborted = true;
                    clearTimeout(timeoutHandle);
                    reject(new Error(`Failed to read request body: ${(error as Error).message}`));
                }
            });
        });
    }

    /**
     * Read request body as Buffer
     */
    readBodyBuffer(res: uWS.HttpResponse): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            const chunks: Buffer[] = [];
            let aborted = false;
            let totalSize = 0;

            const timeoutHandle = setTimeout(() => {
                if (!aborted) {
                    aborted = true;
                    reject(new Error('Request body read timeout'));
                }
            }, this.options.requestTimeoutMs);

            res.onAborted(() => {
                aborted = true;
                clearTimeout(timeoutHandle);
                reject(new Error('Request aborted'));
            });

            res.onData((chunk, isLast) => {
                if (aborted) return;

                try {
                    const chunkSize = chunk.byteLength;
                    totalSize += chunkSize;

                    if (totalSize > this.options.maxBodySize!) {
                        aborted = true;
                        clearTimeout(timeoutHandle);
                        reject(new Error(`Request body too large. Maximum size: ${this.options.maxBodySize} bytes`));
                        return;
                    }

                    chunks.push(Buffer.from(chunk));

                    if (isLast) {
                        clearTimeout(timeoutHandle);
                        const fullBuffer = Buffer.concat(chunks);
                        
                        if (this.options.enableLogging) {
                            this.logger.debug('Request body buffer read completed', {
                                size: totalSize
                            });
                        }
                        
                        resolve(fullBuffer);
                    }
                } catch (error) {
                    aborted = true;
                    clearTimeout(timeoutHandle);
                    reject(new Error(`Failed to read request body buffer: ${(error as Error).message}`));
                }
            });
        });
    }

    /**
     * Parse request body with content type detection
     */
    async parseBody(res: uWS.HttpResponse, req: uWS.HttpRequest): Promise<ParsedBody> {
        try {
            const contentType = req.getHeader('content-type') || '';
            const bodyString = await this.readBody(res);
            
            const result: ParsedBody = {
                success: false,
                contentType,
                size: Buffer.byteLength(bodyString, this.options.defaultEncoding)
            };

            // Parse based on content type
            if (contentType.includes('application/json')) {
                try {
                    result.data = JSON.parse(bodyString);
                    result.success = true;
                } catch (parseError) {
                    result.error = `Invalid JSON: ${(parseError as Error).message}`;
                }
            } else if (contentType.includes('application/x-www-form-urlencoded')) {
                try {
                    result.data = this.parseUrlEncoded(bodyString);
                    result.success = true;
                } catch (parseError) {
                    result.error = `Invalid form data: ${(parseError as Error).message}`;
                }
            } else {
                // Return as plain text for other content types
                result.data = bodyString;
                result.success = true;
            }

            if (this.options.enableLogging) {
                this.logger.debug('Request body parsed', {
                    contentType,
                    size: result.size,
                    success: result.success
                });
            }

            return result;

        } catch (error) {
            return {
                success: false,
                error: (error as Error).message,
                size: 0
            };
        }
    }

    /**
     * Parse URL encoded data
     */
    private parseUrlEncoded(data: string): Record<string, string> {
        const params = new URLSearchParams(data);
        const result: Record<string, string> = {};
        
        for (const [key, value] of params.entries()) {
            result[key] = value;
        }
        
        return result;
    }

    /**
     * Extract query parameters
     */
    getQueryParams(req: uWS.HttpRequest): Record<string, string> {
        const query = req.getQuery();
        if (!query) return {};

        const params = new URLSearchParams(query);
        const result: Record<string, string> = {};
        
        for (const [key, value] of params.entries()) {
            result[key] = value;
        }
        
        return result;
    }

    /**
     * Extract request headers
     */
    getHeaders(req: uWS.HttpRequest): Record<string, string> {
        const headers: Record<string, string> = {};
        
        // Common headers to extract
        const commonHeaders = [
            'content-type', 'content-length', 'authorization', 'user-agent',
            'accept', 'accept-encoding', 'accept-language', 'host', 'origin',
            'referer', 'x-forwarded-for', 'x-real-ip'
        ];

        for (const headerName of commonHeaders) {
            const value = req.getHeader(headerName);
            if (value) {
                headers[headerName] = value;
            }
        }

        return headers;
    }

    /**
     * Get client IP address
     */
    getClientIP(req: uWS.HttpRequest): string {
        // Check for forwarded IP first
        const forwardedFor = req.getHeader('x-forwarded-for');
        if (forwardedFor) {
            return forwardedFor.split(',')[0].trim();
        }

        const realIP = req.getHeader('x-real-ip');
        if (realIP) {
            return realIP;
        }

        // Fallback to remote address (if available in future versions)
        return 'unknown';
    }

    /**
     * Update request manager options
     */
    updateOptions(newOptions: Partial<RequestManagerOptions>): void {
        this.options = { ...this.options, ...newOptions };
    }

    /**
     * Get current options
     */
    getOptions(): RequestManagerOptions {
        return { ...this.options };
    }
}

/**
 * MiddlewareContext - Context object for HTTP requests in middleware chain
 * Contains request/response data and utility methods
 */

import { HttpHandlerUtils } from '../utils/handlers';
import { 
    UWSRequest, 
    UWSResponse, 
    RequestData, 
    RequestBody, 
    RequestHeaders, 
    RequestParams, 
    RequestQuery
} from '../types/middleware.types';
import { User } from '../auth/UserRoleService';
import { AppError, ErrorCode } from '../utils/errorHandler';
import { Logger } from '../utils/logger';

export interface MiddlewareContext {
    req: UWSRequest;
    res: UWSResponse;
    user?: User;
    data?: RequestData;
    params?: RequestParams;
    query?: RequestQuery;
    body?: RequestBody;
    headers?: RequestHeaders;
    method?: string;
    url?: string;
    requestId?: string;
    routePattern?: string; // Add route pattern for path params extraction

    // Utility methods for handling requests and responses
    getRequestBody(): Promise<Record<string, unknown>>;
    sendSuccess(data: Record<string, unknown> | unknown[], message?: string): void;
    sendError(message: string, statusCode?: number): void;
    getQueryParams(): Record<string, string>;
    getPathParams(routePattern?: string): Record<string, string>;
    validateRequiredFields(data: Record<string, unknown>, fields: string[]): void;
}

export interface NextFunction {
    (): Promise<void>;
}

/**
 * Implementation class for MiddlewareContext
 */
export class MiddlewareContextImpl implements MiddlewareContext {
    req: UWSRequest;
    res: UWSResponse;
    user?: User;
    data?: RequestData;
    params?: RequestParams;
    query?: RequestQuery;
    body?: RequestBody;
    headers?: RequestHeaders;
    method?: string;
    url?: string;
    requestId?: string;
    routePattern?: string; // Add route pattern for path params extraction
    private logger: Logger;

    constructor(req: UWSRequest, res: UWSResponse, logger?: Logger) {
        this.req = req;
        this.res = res;
        this.logger = logger || new Logger('MiddlewareContext');
    }

    /**
     * Get parsed JSON body from request
     */
    getRequestBody = async (): Promise<Record<string, unknown>> => {
        return await HttpHandlerUtils.parseRequestBody(
            this.req as any,
            this.res as any
        );
    }

    /**
     * Send success response with consistent format
     */
    sendSuccess = (data: Record<string, unknown> | unknown[], message?: string): void => {
        const response = HttpHandlerUtils.createSuccessResponse(data, message);
        this.sendJsonResponse(response, 200);
    }

    /**
     * Send error response with consistent format
     */
    sendError = (message: string, statusCode: number = 400): void => {
        const response = HttpHandlerUtils.createErrorResponse(message);
        this.sendJsonResponse(response, statusCode);
    }

    /**
     * Extract query parameters from request
     */
    getQueryParams = (): Record<string, string> => {
        return HttpHandlerUtils.extractQueryParams(this.req as any);
    }

    /**
     * Extract path parameters from request
     */
    getPathParams = (routePattern?: string): Record<string, string> => {
        const pattern = routePattern || this.routePattern;
        if (!pattern) {
            // If no pattern provided, try to extract from params if already populated
            return this.params || {};
        }
        const url = this.url || '';
        const pathParams = HttpHandlerUtils.extractPathParams(url, pattern);
        
        // Store the extracted params for future use
        if (!this.params) {
            this.params = pathParams;
        }
        
        return pathParams;
    }

    /**
     * Validate required fields in request body
     */
    validateRequiredFields = (data: Record<string, unknown>, fields: string[]): void => {
        const result = HttpHandlerUtils.validateRequiredFields(data, fields);
        if (!result.valid) {
            throw new AppError(
                `Missing required fields: ${result.missing.join(', ')}`,
                ErrorCode.MISSING_REQUIRED_FIELDS
            );
        }
    }

    /**
     * Send JSON response helper
     */
    private sendJsonResponse(data: any, statusCode: number = 200): void {
        try {
            const jsonString = JSON.stringify(data);
            
            // Cast to proper uWS.HttpResponse type for API access
            const response = this.res as any;
            
            // Use cork() for better performance and to avoid issues
            response.cork(() => {
                response.writeStatus(`${statusCode}`);
                response.writeHeader('Content-Type', 'application/json; charset=utf-8');
                response.end(jsonString);
            });
        } catch (error) {
            this.logger.error('MiddlewareContext: Failed to send JSON response:', error);
            
            // Try to send a basic error response if the original response failed
            try {
                const response = this.res as any;
                response.cork(() => {
                    response.writeStatus('500 Internal Server Error');
                    response.writeHeader('Content-Type', 'application/json; charset=utf-8');
                    response.end(JSON.stringify({ 
                        success: false, 
                        error: 'Internal server error' 
                    }));
                });
            } catch (fallbackError) {
                this.logger.error('MiddlewareContext: Failed to send fallback error response:', fallbackError);
            }
            throw error;
        }
    }
}

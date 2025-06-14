import { ErrorResponse } from '../types';
import { Logger } from './logger';

export enum ErrorCode {
    // Client Errors (4xx)
    BAD_REQUEST = 'BAD_REQUEST',
    VALIDATION_ERROR = 'VALIDATION_ERROR',
    AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
    AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
    NOT_FOUND = 'NOT_FOUND',
    METHOD_NOT_ALLOWED = 'METHOD_NOT_ALLOWED',
    CONFLICT = 'CONFLICT',
    PAYLOAD_TOO_LARGE = 'PAYLOAD_TOO_LARGE',
    UNSUPPORTED_MEDIA_TYPE = 'UNSUPPORTED_MEDIA_TYPE',
    RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
    MISSING_REQUIRED_FIELDS = 'MISSING_REQUIRED_FIELDS',
    
    // Server Errors (5xx)
    INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
    DATABASE_ERROR = 'DATABASE_ERROR',
    NETWORK_ERROR = 'NETWORK_ERROR',
    SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
    TIMEOUT_ERROR = 'TIMEOUT_ERROR',
    CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
    
    // Business Logic Errors
    BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION',
    INSUFFICIENT_RESOURCES = 'INSUFFICIENT_RESOURCES',
    OPERATION_NOT_PERMITTED = 'OPERATION_NOT_PERMITTED'
}

export enum ErrorSeverity {
    LOW = 'LOW',
    MEDIUM = 'MEDIUM',
    HIGH = 'HIGH',
    CRITICAL = 'CRITICAL'
}

export enum ErrorCategory {
    SYSTEM = 'SYSTEM',
    BUSINESS = 'BUSINESS',
    SECURITY = 'SECURITY',
    NETWORK = 'NETWORK',
    DATABASE = 'DATABASE',
    VALIDATION = 'VALIDATION'
}

export interface ErrorMetrics {
    count: number;
    lastOccurred: Date;
    contexts: string[];
}

export interface ErrorDetails {
    field?: string;
    value?: any;
    constraint?: string;
    resource?: string;
    operation?: string;
    userId?: string;
    requestId?: string;
    [key: string]: any;
}

export class AppError extends Error {
    public readonly code: ErrorCode;
    public readonly statusCode: number;
    public readonly details?: ErrorDetails;
    public readonly severity: ErrorSeverity;
    public readonly category: ErrorCategory;
    public readonly isOperational: boolean;
    public readonly timestamp: Date;
    public readonly requestId?: string;

    constructor(
        message: string, 
        code: ErrorCode, 
        statusCode: number = 500, 
        details?: ErrorDetails,
        severity: ErrorSeverity = ErrorSeverity.MEDIUM,
        category: ErrorCategory = ErrorCategory.SYSTEM,
        isOperational: boolean = true
    ) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
        this.severity = severity;
        this.category = category;
        this.isOperational = isOperational;
        this.timestamp = new Date();
        this.name = 'AppError';
        
        // Capture stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, AppError);
        }
    }

    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            statusCode: this.statusCode,
            severity: this.severity,
            category: this.category,
            timestamp: this.timestamp,
            details: this.details,
            stack: this.stack
        };
    }
}

export class ErrorHandler {
    private logger: Logger;
    private isProduction: boolean;
    private errorMetrics: Map<string, ErrorMetrics> = new Map();
    private errorRateLimit: Map<string, number> = new Map();
    private rateLimitWindow: number = 60000; // 1 minute
    private maxErrorsPerWindow: number = 10;

    constructor(logger: Logger, isProduction: boolean = process.env.NODE_ENV === 'production') {
        this.logger = logger;
        this.isProduction = isProduction;
        
        // Clean up rate limit periodically
        setInterval(() => this.cleanupRateLimit(), this.rateLimitWindow);
    }

    /**
     * Main error handling method with enhanced features
     * Returns both the error response and the HTTP status code
     */
    handleError(error: Error | AppError, context?: string, requestId?: string): { response: ErrorResponse; statusCode: number } {
        const appError = this.normalizeError(error, context, requestId);
        
        // Update metrics
        this.updateErrorMetrics(appError, context);
        
        // Check rate limiting for logging
        if (this.shouldLogError(appError, context)) {
            this.logError(appError, context);
        }

        return {
            response: this.createErrorResponse(appError),
            statusCode: appError.statusCode
        };
    }

    /**
     * Normalize any error to AppError
     */
    private normalizeError(error: Error | AppError, context?: string, requestId?: string): AppError {   
        // Check for AppError using multiple methods to handle instanceof issues
        if (error instanceof AppError || 
            (error as any).name === 'AppError' ||
            (error as any).code && (error as any).statusCode) {
            console.log('AppError detected, returning as-is');
            return error as AppError;
        }

        // Handle specific error types
        if (error.name === 'ValidationError') {
            return new AppError(
                error.message,
                ErrorCode.VALIDATION_ERROR,
                400,
                { originalError: error.name },
                ErrorSeverity.LOW,
                ErrorCategory.VALIDATION
            );
        }

        if (error.name === 'CastError' || error.name === 'MongoError') {
            return new AppError(
                'Database operation failed',
                ErrorCode.DATABASE_ERROR,
                500,
                { originalError: error.name, context },
                ErrorSeverity.HIGH,
                ErrorCategory.DATABASE
            );
        }

        if (error.name === 'TimeoutError') {
            return new AppError(
                'Operation timed out',
                ErrorCode.TIMEOUT_ERROR,
                408,
                { originalError: error.name, context },
                ErrorSeverity.MEDIUM,
                ErrorCategory.NETWORK
            );
        }

        // Default to internal server error
        return new AppError(
            this.isProduction ? 'An unexpected error occurred' : error.message,
            ErrorCode.INTERNAL_SERVER_ERROR,
            500,
            { originalError: error.name, context, requestId },
            ErrorSeverity.CRITICAL,
            ErrorCategory.SYSTEM,
            false // Not operational - unexpected error
        );
    }

    /**
     * Create error response with appropriate detail level
     */
    private createErrorResponse(error: AppError): ErrorResponse {
        const baseResponse: ErrorResponse = {
            error: error.message,
            code: error.code,
            timestamp: error.timestamp
        };

        // In development, include more details
        if (!this.isProduction) {
            baseResponse.details = error.details;
            baseResponse.stack = this.sanitizeStackTrace(error.stack);
            baseResponse.severity = error.severity;
            baseResponse.category = error.category;
        } else {
            // In production, only include safe details
            if (error.isOperational && error.details) {
                baseResponse.details = this.sanitizeDetailsForProduction(error.details);
            }
        }

        return baseResponse;
    }

    /**
     * Log error with appropriate level based on severity
     */
    private logError(error: AppError, context?: string): void {
        const logContext = context ? ` in ${context}` : '';
        const logData = {
            code: error.code,
            severity: error.severity,
            category: error.category,
            statusCode: error.statusCode,
            details: error.details,
            stack: error.stack
        };

        switch (error.severity) {
            case ErrorSeverity.CRITICAL:
                this.logger.error(`CRITICAL Error${logContext}: ${error.message}`, logData);
                break;
            case ErrorSeverity.HIGH:
                this.logger.error(`HIGH Error${logContext}: ${error.message}`, logData);
                break;
            case ErrorSeverity.MEDIUM:
                this.logger.warn(`MEDIUM Error${logContext}: ${error.message}`, logData);
                break;
            case ErrorSeverity.LOW:
                this.logger.info(`LOW Error${logContext}: ${error.message}`, logData);
                break;
        }
    }

    /**
     * Update error metrics for monitoring
     */
    private updateErrorMetrics(error: AppError, context?: string): void {
        const key = `${error.code}_${error.category}`;
        const existing = this.errorMetrics.get(key);
        
        if (existing) {
            existing.count++;
            existing.lastOccurred = new Date();
            if (context && !existing.contexts.includes(context)) {
                existing.contexts.push(context);
            }
        } else {
            this.errorMetrics.set(key, {
                count: 1,
                lastOccurred: new Date(),
                contexts: context ? [context] : []
            });
        }
    }

    /**
     * Rate limiting for error logging to prevent spam
     */
    private shouldLogError(error: AppError, context?: string): boolean {
        const key = `${error.code}_${context || 'unknown'}`;
        const now = Date.now();
        const windowStart = now - this.rateLimitWindow;
        
        // Clean old entries for this key
        const currentCount = this.errorRateLimit.get(key) || 0;
        
        if (currentCount >= this.maxErrorsPerWindow) {
            return false; // Rate limited
        }
        
        this.errorRateLimit.set(key, currentCount + 1);
        return true;
    }

    /**
     * Clean up rate limit tracking
     */
    private cleanupRateLimit(): void {
        this.errorRateLimit.clear();
    }

    /**
     * Sanitize stack trace for production
     */
    private sanitizeStackTrace(stack?: string): string | undefined {
        if (!stack || this.isProduction) return undefined;
        
        // Remove sensitive paths and internal modules
        return stack
            .split('\n')
            .filter(line => !line.includes('node_modules'))
            .filter(line => !line.includes('internal/'))
            .join('\n');
    }

    /**
     * Sanitize error details for production
     */
    private sanitizeDetailsForProduction(details: ErrorDetails): Partial<ErrorDetails> {
        const safe: Partial<ErrorDetails> = {};
        
        // Only include safe fields
        if (details.field) safe.field = details.field;
        if (details.constraint) safe.constraint = details.constraint;
        if (details.resource) safe.resource = details.resource;
        if (details.operation) safe.operation = details.operation;
        
        return safe;
    }

    /**
     * Get error metrics for monitoring
     */
    getErrorMetrics(): Map<string, ErrorMetrics> {
        return new Map(this.errorMetrics);
    }

    /**
     * Clear error metrics
     */
    clearErrorMetrics(): void {
        this.errorMetrics.clear();
    }

    // ============================================================================
    // ERROR CREATION HELPERS
    // ============================================================================

    /**
     * Create validation error with field-specific details
     */
    createValidationError(message: string, field?: string, value?: any, constraint?: string): AppError {
        return new AppError(
            message,
            ErrorCode.VALIDATION_ERROR,
            400,
            { field, value, constraint },
            ErrorSeverity.LOW,
            ErrorCategory.VALIDATION
        );
    }

    /**
     * Create multiple validation errors
     */
    createValidationErrors(errors: Array<{field: string, message: string, value?: any}>): AppError {
        return new AppError(
            'Validation failed for multiple fields',
            ErrorCode.VALIDATION_ERROR,
            400,
            { validationErrors: errors },
            ErrorSeverity.LOW,
            ErrorCategory.VALIDATION
        );
    }

    /**
     * Create database error with operation context
     */
    createDatabaseError(message: string, operation?: string, resource?: string, details?: any): AppError {
        return new AppError(
            message,
            ErrorCode.DATABASE_ERROR,
            500,
            { operation, resource, ...details },
            ErrorSeverity.HIGH,
            ErrorCategory.DATABASE
        );
    }

    /**
     * Create authentication error
     */
    createAuthenticationError(message: string = 'Authentication failed', details?: ErrorDetails): AppError {
        return new AppError(
            message,
            ErrorCode.AUTHENTICATION_ERROR,
            401,
            details,
            ErrorSeverity.MEDIUM,
            ErrorCategory.SECURITY
        );
    }

    /**
     * Create authorization error
     */
    createAuthorizationError(message: string = 'Insufficient permissions', resource?: string, operation?: string): AppError {
        return new AppError(
            message,
            ErrorCode.AUTHORIZATION_ERROR,
            403,
            { resource, operation },
            ErrorSeverity.MEDIUM,
            ErrorCategory.SECURITY
        );
    }

    /**
     * Create not found error
     */
    createNotFoundError(resource: string = 'Resource', id?: string): AppError {
        return new AppError(
            `${resource} not found`,
            ErrorCode.NOT_FOUND,
            404,
            { resource, id },
            ErrorSeverity.LOW,
            ErrorCategory.BUSINESS
        );
    }

    /**
     * Create conflict error (e.g., duplicate resource)
     */
    createConflictError(message: string, resource?: string, conflictingField?: string): AppError {
        return new AppError(
            message,
            ErrorCode.CONFLICT,
            409,
            { resource, conflictingField },
            ErrorSeverity.MEDIUM,
            ErrorCategory.BUSINESS
        );
    }

    /**
     * Create rate limit error
     */
    createRateLimitError(limit: number, windowMs: number, resource?: string): AppError {
        return new AppError(
            'Rate limit exceeded',
            ErrorCode.RATE_LIMIT_EXCEEDED,
            429,
            { limit, windowMs, resource, retryAfter: Math.ceil(windowMs / 1000) },
            ErrorSeverity.LOW,
            ErrorCategory.SECURITY
        );
    }

    /**
     * Create business rule violation error
     */
    createBusinessRuleError(message: string, rule?: string, context?: any): AppError {
        return new AppError(
            message,
            ErrorCode.BUSINESS_RULE_VIOLATION,
            422,
            { rule, context },
            ErrorSeverity.MEDIUM,
            ErrorCategory.BUSINESS
        );
    }

    /**
     * Create timeout error
     */
    createTimeoutError(operation: string, timeoutMs: number): AppError {
        return new AppError(
            `Operation '${operation}' timed out`,
            ErrorCode.TIMEOUT_ERROR,
            408,
            { operation, timeoutMs },
            ErrorSeverity.MEDIUM,
            ErrorCategory.NETWORK
        );
    }

    /**
     * Create network error
     */
    createNetworkError(message: string, host?: string, port?: number): AppError {
        return new AppError(
            message,
            ErrorCode.NETWORK_ERROR,
            503,
            { host, port },
            ErrorSeverity.HIGH,
            ErrorCategory.NETWORK
        );
    }

    /**
     * Create configuration error
     */
    createConfigurationError(message: string, configKey?: string): AppError {
        return new AppError(
            message,
            ErrorCode.CONFIGURATION_ERROR,
            500,
            { configKey },
            ErrorSeverity.CRITICAL,
            ErrorCategory.SYSTEM,
            false // Not operational - config issue
        );
    }

    // ============================================================================
    // UTILITY METHODS
    // ============================================================================

    /**
     * Check if error is operational (expected) or programming error
     */
    isOperationalError(error: Error): boolean {
        if (error instanceof AppError) {
            return error.isOperational;
        }
        return false;
    }

    /**
     * Get error severity for monitoring/alerting
     */
    getErrorSeverity(error: Error): ErrorSeverity {
        if (error instanceof AppError) {
            return error.severity;
        }
        return ErrorSeverity.CRITICAL; // Unknown errors are critical
    }

    /**
     * Create error from HTTP status code
     */
    createFromHttpStatus(statusCode: number, message?: string): AppError {
        switch (statusCode) {
            case 400:
                return this.createValidationError(message || 'Bad request');
            case 401:
                return this.createAuthenticationError(message);
            case 403:
                return this.createAuthorizationError(message);
            case 404:
                return this.createNotFoundError(message || 'Resource');
            case 409:
                return this.createConflictError(message || 'Resource conflict');
            case 429:
                return this.createRateLimitError(100, 60000); // Default rate limit
            case 500:
            default:
                return new AppError(
                    message || 'Internal server error',
                    ErrorCode.INTERNAL_SERVER_ERROR,
                    statusCode,
                    undefined,
                    ErrorSeverity.CRITICAL,
                    ErrorCategory.SYSTEM
                );
        }
    }

    /**
     * Wrap async function with error handling
     */
    async wrapAsync<T>(
        fn: () => Promise<T>,
        context: string,
        onError?: (error: AppError) => void
    ): Promise<T> {
        try {
            return await fn();
        } catch (error) {
            const appError = this.normalizeError(error as Error, context);
            if (onError) {
                onError(appError);
            }
            throw appError;
        }
    }
}

import { UWebSocketWrapper } from '../core/ServerWrapper';
import { ErrorHandler, AppError, ErrorSeverity } from '../utils/errorHandler';
import { Logger } from '../utils/logger';

/**
 * Global error middleware for handling uncaught errors
 */
export class ErrorMiddleware {
    private errorHandler: ErrorHandler;
    private logger: Logger;

    constructor(errorHandler: ErrorHandler, logger: Logger) {
        this.errorHandler = errorHandler;
        this.logger = logger;
    }

    /**
     * Setup global error handlers for the application
     */
    setupGlobalErrorHandlers(): void {
        // Handle uncaught exceptions
        process.on('uncaughtException', (error: Error) => {
            this.logger.error('Uncaught Exception:', error);
            const { response: errorResponse } = this.errorHandler.handleError(error, 'Uncaught Exception');
            
            // For critical errors, we might want to gracefully shutdown
            if (this.errorHandler.getErrorSeverity(error) === ErrorSeverity.CRITICAL) {
                this.gracefulShutdown('Uncaught Exception', error);
            }
        });

        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
            this.logger.error('Unhandled Rejection:', { 
                promise: promise.toString(),
                reason: reason 
            });
            
            const error = reason instanceof Error ? reason : new Error(String(reason));
            const { response: errorResponse } = this.errorHandler.handleError(error, 'Unhandled Rejection');
            
            // For critical errors, we might want to gracefully shutdown
            if (this.errorHandler.getErrorSeverity(error) === ErrorSeverity.CRITICAL) {
                this.gracefulShutdown('Unhandled Rejection', error);
            }
        });

        // Handle SIGTERM and SIGINT for graceful shutdown
        process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
    }

    /**
     * Create error monitoring endpoints
     */
    setupErrorMonitoringRoutes(server: UWebSocketWrapper): void {
        // Endpoint to get error metrics
        server.addHttpHandler('get', '/internal/error-metrics', (req, res) => {
            try {
                const metrics = this.errorHandler.getErrorMetrics();
                const metricsData = Array.from(metrics.entries()).map(([key, value]) => ({
                    errorType: key,
                    count: value.count,
                    lastOccurred: value.lastOccurred,
                    contexts: value.contexts
                }));

                server.sendJSON(res, { 
                    metrics: metricsData,
                    timestamp: new Date()
                });
            } catch (error) {
                const { response: errorResponse, statusCode } = this.errorHandler.handleError(error as Error, 'Error Metrics');
                server.sendJSON(res, errorResponse, statusCode);
            }
        });

        // Endpoint to clear error metrics
        server.addHttpHandler('post', '/internal/error-metrics/clear', (req, res) => {
            try {
                this.errorHandler.clearErrorMetrics();
                server.sendJSON(res, { 
                    message: 'Error metrics cleared successfully',
                    timestamp: new Date()
                });
            } catch (error) {
                const { response: errorResponse, statusCode } = this.errorHandler.handleError(error as Error, 'Clear Error Metrics');
                server.sendJSON(res, errorResponse, statusCode);
            }
        });

        // Health check endpoint with error status
        server.addHttpHandler('get', '/internal/health', (req, res) => {
            try {
                const metrics = this.errorHandler.getErrorMetrics();
                const criticalErrors = Array.from(metrics.entries())
                    .filter(([key, value]) => key.includes('CRITICAL'))
                    .reduce((sum, [, value]) => sum + value.count, 0);

                const status = criticalErrors > 0 ? 'degraded' : 'healthy';
                
                server.sendJSON(res, {
                    status,
                    timestamp: new Date(),
                    errorSummary: {
                        totalErrorTypes: metrics.size,
                        criticalErrors
                    }
                });
            } catch (error) {
                const { response: errorResponse, statusCode } = this.errorHandler.handleError(error as Error, 'Health Check');
                server.sendJSON(res, errorResponse, statusCode);
            }
        });
    }

    /**
     * Graceful shutdown handler
     */
    private gracefulShutdown(signal: string, error?: Error): void {
        this.logger.warn(`Received ${signal}. Starting graceful shutdown...`);
        
        if (error) {
            this.logger.error('Shutdown triggered by error:', error);
        }

        // Give the application time to finish current requests
        setTimeout(() => {
            this.logger.info('Graceful shutdown completed');
            process.exit(error ? 1 : 0);
        }, 5000); // 5 seconds timeout
    }

    /**
     * Create custom error page handler
     */
    createErrorPageHandler(): (req: any, res: any, error: AppError) => void {
        return (req: any, res: any, error: AppError) => {
            const isApiRequest = req.getHeader('accept')?.includes('application/json') || 
                               req.getUrl().startsWith('/api');

            if (isApiRequest) {
                // Return JSON error for API requests
                const { response: errorResponse, statusCode } = this.errorHandler.handleError(error, 'API Error');
                res.writeStatus(statusCode.toString());
                res.writeHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(errorResponse));
            } else {
                // Return HTML error page for web requests
                const { response: errorResponse, statusCode } = this.errorHandler.handleError(error, 'API Error');
                const htmlErrorPage = this.generateErrorPage(error);
                res.writeStatus(statusCode.toString());
                res.writeHeader('Content-Type', 'text/html');
                res.end(htmlErrorPage);
            }
        };
    }

    /**
     * Generate HTML error page
     */
    private generateErrorPage(error: AppError): string {
        const isDevelopment = process.env.NODE_ENV !== 'production';
        
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Error ${error.statusCode}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .error-container { 
            max-width: 600px; margin: 0 auto; background: white; 
            padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .error-code { font-size: 72px; color: #e74c3c; margin: 0; }
        .error-message { font-size: 24px; color: #2c3e50; margin: 20px 0; }
        .error-details { background: #ecf0f1; padding: 20px; border-radius: 4px; margin-top: 20px; }
        .stack-trace { background: #2c3e50; color: #ecf0f1; padding: 20px; border-radius: 4px; margin-top: 20px; font-family: monospace; font-size: 12px; overflow-x: auto; }
    </style>
</head>
<body>
    <div class="error-container">
        <div class="error-code">${error.statusCode}</div>
        <div class="error-message">${error.message}</div>
        
        ${error.details ? `<div class="error-details">
            <strong>Details:</strong>
            <pre>${JSON.stringify(error.details, null, 2)}</pre>
        </div>` : ''}
        
        ${isDevelopment && error.stack ? `<div class="stack-trace">${error.stack}</div>` : ''}
        
        <p style="margin-top: 30px; color: #7f8c8d;">
            <small>Error occurred at: ${error.timestamp}</small>
        </p>
    </div>
</body>
</html>`;
    }
}

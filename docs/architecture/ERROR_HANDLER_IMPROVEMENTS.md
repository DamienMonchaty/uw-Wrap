# Error Handling System - uW-Wrap

Documentation of the error handling system integrated into the uWebSockets.js wrapper.

## 🎯 Overview

The uW-Wrap wrapper provides a comprehensive error handling system with:

- **Standardized error codes** with automatic mapping to HTTP codes
- **Error severity levels** for logging and monitoring
- **BaseHandler** for automatic error management
- **Error middleware** for centralized processing
- **Structured logging** with detailed context

## 🏗️ Architecture

```
src/
├── core/
│   └── BaseHandler.ts          # Base handler with error management
├── middleware/
│   └── errorMiddleware.ts      # Centralized middleware
└── utils/
    ├── errorHandler.ts         # Error classes and enums
    └── logger.ts               # Logging system
```

## 🔧 Error Classes

### AppError - Application Error

```typescript
import { AppError, ErrorCode, ErrorSeverity } from './src/utils/errorHandler';

// Simple error
throw new AppError('User not found', ErrorCode.NOT_FOUND);

// Error with context
throw new AppError(
  'Email already in use',
  ErrorCode.CONFLICT,
  { field: 'email', value: 'user@example.com' }
);

// Error with custom severity
throw new AppError(
  'External service unavailable',
  ErrorCode.SERVICE_UNAVAILABLE,
  { service: 'payment-api' },
  ErrorSeverity.HIGH
);
```

### Available Error Codes

```typescript
export enum ErrorCode {
  // Client errors (4xx)
  BAD_REQUEST = 'BAD_REQUEST',                    // 400
  VALIDATION_ERROR = 'VALIDATION_ERROR',          // 400
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR', // 401
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',    // 403
  NOT_FOUND = 'NOT_FOUND',                       // 404
  CONFLICT = 'CONFLICT',                         // 409
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',   // 429

  // Server errors (5xx)
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR', // 500
  DATABASE_ERROR = 'DATABASE_ERROR',               // 500
  NETWORK_ERROR = 'NETWORK_ERROR',                 // 502
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',     // 503
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',                 // 504
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',     // 500

  // Business errors
  BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION',     // 422
  INSUFFICIENT_RESOURCES = 'INSUFFICIENT_RESOURCES',       // 422
  OPERATION_NOT_PERMITTED = 'OPERATION_NOT_PERMITTED'      // 422
}
```

### Error Severity

```typescript
export enum ErrorSeverity {
  LOW = 'LOW',        // Expected errors (validation, 404)
  MEDIUM = 'MEDIUM',  // Important business errors
  HIGH = 'HIGH',      // Critical system errors
  CRITICAL = 'CRITICAL' // Errors requiring immediate intervention
}
```

## 🛠️ Usage in Handlers

### 1. Inherit from BaseHandler

```typescript
import { BaseHandler } from './src/core/BaseHandler';
import { AppError, ErrorCode } from './src/utils/errorHandler';

class UserHandler extends BaseHandler {
  async getUser(res: any, req: any) {
    try {
      const id = req.getParameter(0);
      
      if (!id) {
        throw new AppError(
          'User ID required',
          ErrorCode.VALIDATION_ERROR,
          { parameter: 'id' }
        );
      }

      const user = await this.userService.getUserById(parseInt(id));
      
      if (!user) {
        throw new AppError(
          'User not found',
          ErrorCode.NOT_FOUND,
          { userId: id }
        );
      }

      return user;
    } catch (error) {
      // BaseHandler automatically handles the error
      this.handleError(error, res);
    }
  }
}
```

### 2. Automatic Error Handling

The `BaseHandler` provides several useful methods:

```typescript
export class BaseHandler {
  // Automatic handling with logging
  protected handleError(error: unknown, res: any): void {
    if (error instanceof AppError) {
      // Log with appropriate level based on severity
      this.logError(error);
      
      // Appropriate HTTP response
      this.sendErrorResponse(res, error);
    } else {
      // Unexpected error -> 500
      const appError = new AppError(
        'Internal server error',
        ErrorCode.INTERNAL_SERVER_ERROR,
        { originalError: error.message },
        ErrorSeverity.HIGH
      );
      
      this.handleError(appError, res);
    }
  }

  // Validation with automatic error
  protected validateRequired(value: any, fieldName: string): void {
    if (!value) {
      throw new AppError(
        `Field ${fieldName} is required`,
        ErrorCode.VALIDATION_ERROR,
        { field: fieldName }
      );
    }
  }

  // Authentication with automatic error
  protected requireAuth(req: any): any {
    const token = req.getHeader('authorization')?.replace('Bearer ', '');
    
    if (!token) {
      throw new AppError(
        'Authentication token required',
        ErrorCode.AUTHENTICATION_ERROR
      );
    }

    const payload = this.jwtManager.verifyToken(token);
    
    if (!payload) {
      throw new AppError(
        'Invalid or expired token',
        ErrorCode.AUTHENTICATION_ERROR
      );
    }

    return payload;
  }
}
```

## 🔧 Error Middleware

### Automatic Configuration

```typescript
import { errorMiddleware } from './src/middleware/errorMiddleware';
import { uWebSocketWrapper } from './src/core/uWebSocketWrapper';

const app = uWebSocketWrapper({
  port: 3000,
  middleware: [errorMiddleware], // Middleware applied automatically
  routes: [
    // ... your routes
  ]
});
```

### Custom Middleware

```typescript
import { AppError, ErrorCode } from './src/utils/errorHandler';

const customErrorMiddleware = (error: unknown, res: any, req: any) => {
  // Enrich error with request context
  if (error instanceof AppError) {
    error.context = {
      ...error.context,
      method: req.getMethod(),
      path: req.getUrl(),
      userAgent: req.getHeader('user-agent'),
      ip: req.getHeader('x-forwarded-for') || 'unknown'
    };
  }

  // Special handling for certain error types
  if (error instanceof AppError && error.code === ErrorCode.RATE_LIMIT_EXCEEDED) {
    res.writeHeader('Retry-After', '60');
  }

  // Delegate to default middleware
  errorMiddleware(error, res, req);
};
```

## 📊 Logging and Monitoring

### Structured Logs

```typescript
// Errors are automatically logged with context
{
  "level": "ERROR",
  "timestamp": "2025-06-09T16:30:00.000Z",
  "message": "Email already in use",
  "error": {
    "code": "CONFLICT",
    "severity": "MEDIUM",
    "context": {
      "field": "email",
      "value": "user@example.com",
      "method": "POST",
      "path": "/users"
    }
  },
  "stack": "..."
}
```

### Error Metrics

```typescript
import { getErrorMetrics } from './src/utils/errorHandler';

// Get metrics
const metrics = getErrorMetrics();

console.log('Errors by code:', metrics.byCode);
console.log('Errors by severity:', metrics.bySeverity);
console.log('Total errors last hour:', metrics.lastHour);
```

## 🚀 Best Practices

### 1. Using Error Codes

```typescript
// ✅ Good - Specific code
throw new AppError('Email already in use', ErrorCode.CONFLICT);

// ❌ Avoid - Generic code
throw new AppError('Validation error', ErrorCode.BAD_REQUEST);
```

### 2. Rich Context

```typescript
// ✅ Good - Detailed context
throw new AppError(
  'Validation failed',
  ErrorCode.VALIDATION_ERROR,
  {
    field: 'email',
    value: userInput.email,
    rule: 'format',
    expected: 'valid email format'
  }
);

// ❌ Avoid - No context
throw new AppError('Validation failed', ErrorCode.VALIDATION_ERROR);
```

### 3. Appropriate Severity

```typescript
// ✅ Good - Severity based on impact
throw new AppError(
  'User not found',
  ErrorCode.NOT_FOUND,
  { userId: id },
  ErrorSeverity.LOW  // Expected error
);

throw new AppError(
  'Database unavailable',
  ErrorCode.DATABASE_ERROR,
  { provider: 'mysql' },
  ErrorSeverity.CRITICAL  // Critical system issue
);
```

### 4. Handling External Errors

```typescript
try {
  const result = await externalApi.call();
} catch (error) {
  // Transform external error to AppError
  throw new AppError(
    'External service unavailable',
    ErrorCode.SERVICE_UNAVAILABLE,
    {
      service: 'external-api',
      originalError: error.message
    },
    ErrorSeverity.HIGH
  );
}
```

## 🔍 Integration Examples

See the `example/handlers/` folder for concrete examples of using the error system.
    CRITICAL = 'CRITICAL'  // Critical errors requiring attention
}

export enum ErrorCategory {
    SYSTEM, BUSINESS, SECURITY, NETWORK, DATABASE, VALIDATION
}
```

### ✅ 4. Enhanced AppError with metadata
```typescript
export class AppError extends Error {
    public readonly code: ErrorCode;
    public readonly statusCode: number;
    public readonly details?: ErrorDetails;
    public readonly severity: ErrorSeverity;
    public readonly category: ErrorCategory;
    public readonly isOperational: boolean;
    public readonly timestamp: Date;
    public readonly requestId?: string;
}
```

### ✅ 5. Error metrics and monitoring
- **Automatic counting** of errors by type and context
- **Rate limiting** of logs to prevent spam
- **Monitoring endpoints**:
  - `GET /internal/error-metrics` - Detailed metrics
  - `GET /internal/health` - Health with error summary
  - `POST /internal/error-metrics/clear` - Reset metrics

### ✅ 6. Global error handling with middleware
```typescript
export class ErrorMiddleware {
    setupGlobalErrorHandlers()          // uncaughtException, unhandledRejection
    setupErrorMonitoringRoutes()        // Monitoring endpoints  
    createErrorPageHandler()             // HTML/JSON error pages adapted
    gracefulShutdown()                  // Clean shutdown on critical errors
}
```

### ✅ 7. Validation and error creation helpers in BaseHandler
```typescript
protected createValidationError(message, field?, value?): never
protected createNotFoundError(resource, id?): never  
protected createUnauthorizedError(message?): never
protected createForbiddenError(message?, resource?): never
protected createConflictError(message, resource?): never
protected createBusinessRuleError(message, rule?): never
protected validateRequiredFields(data, requiredFields): void
```

### ✅ 8. Production/Development differentiation
- **Production**: Sanitized stack traces, filtered details
- **Development**: Complete errors with stack traces and details

### ✅ 9. Specific error handling
- **Automatic validation** of JWT, MongoDB, TimeoutError errors
- **Normalization** of all errors to AppError
- **Automatic Request ID** for traceability

## 📊 Test Results

### Test 1: Required field validation
```bash
curl -X POST /users -d "{}"
# ✅ Result: VALIDATION_ERROR, severity: LOW, category: VALIDATION
```

### Test 2: Invalid email validation  
```bash
curl -X POST /users -d '{"username":"test", "email":"invalid", "name":"Test"}'
# ✅ Result: VALIDATION_ERROR with field and value details
```

### Test 3: Non-existent user
```bash
curl -X GET /users/9999  
# ✅ Result: NOT_FOUND, severity: LOW, category: BUSINESS
```

### Test 4: Error metrics
```bash
curl -X GET /internal/error-metrics
# ✅ Result: Tracking of 3 error types with counters and contexts
```

### Test 5: System health
```bash
curl -X GET /internal/health
# ✅ Result: Status "healthy" with error summary (0 critical)
```

## 🚀 Benefits Achieved

1. **Maintainability**: Organized and reusable error code
2. **Monitoring**: Detailed metrics for production surveillance  
3. **Debugging**: Traceability with request IDs and stack traces
4. **Security**: Automatic error sanitization in production
5. **Scalability**: Rate limiting and memory management of metrics
6. **DevOps**: Health endpoints for load balancers and monitoring

## 🎯 Possible Next Steps

1. **Alerting**: Integration with alert systems (Slack, email)
2. **External logging**: Export to ELK, Datadog, etc.
3. **Circuit breaker**: Protection against error cascades
4. **Retry logic**: Automatic retries for temporary errors
5. **Error boundaries**: Error isolation by modules

---
*ErrorHandler v2.0 - Production ready with advanced monitoring* ✨

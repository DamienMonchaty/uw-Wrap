/**
 * Shared types and interfaces for the decorator system
 * Following Single Responsibility Principle - only type definitions
 */

import 'reflect-metadata';

// Route metadata types
export interface RouteMetadata {
    method: 'get' | 'post' | 'put' | 'delete' | 'patch';
    path: string;
    middlewares: MiddlewareMetadata[];
    handler: string;
}

export interface MiddlewareMetadata {
    type: 'auth' | 'validate' | 'rateLimit' | 'cors' | 'logging' | 'cache' | 'custom';
    options?: any;
}

export interface ClassMetadata {
    basePath?: string;
    middlewares: MiddlewareMetadata[];
}

// Internal route representation (used during decoration phase)
export interface RawRouteMetadata {
    method: string;
    path: string;
    handler: string;
    target: any;
    propertyKey: string;
}

// Metadata keys for reflection
export const METADATA_KEYS = {
    ROUTES: Symbol('routes'),
    MIDDLEWARES: Symbol('middlewares'),
    CLASS_METADATA: Symbol('classMetadata')
} as const;

// Authentication options
export interface AuthOptions {
    roles?: string[];
}

// Validation options
export interface ValidationOptions {
    schema: any;
}

// Rate limiting options
export interface RateLimitOptions {
    max: number;
    windowMs: number;
    message?: string;
}

// CORS options
export interface CorsOptions {
    origin?: string | string[] | boolean;
    methods?: string[];
    allowedHeaders?: string[];
    credentials?: boolean;
}

import * as uWS from 'uWebSockets.js';

// Re-export uWebSockets types for easier use
export type HttpRequest = uWS.HttpRequest;
export type HttpResponse = uWS.HttpResponse;
export type TemplatedApp = uWS.TemplatedApp;

// Enhanced request interface with body parsing
export interface EnhancedHttpRequest extends uWS.HttpRequest {
    body?: any;
    user?: any;
    params?: Record<string, string>;
    query?: Record<string, string>;
    headers?: Record<string, string>;
}

// Type guards and utilities
export function isEnhancedRequest(req: any): req is EnhancedHttpRequest {
    return req && typeof req === 'object';
}

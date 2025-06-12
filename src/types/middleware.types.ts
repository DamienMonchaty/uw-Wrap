/**
 * Types TypeScript stricts pour les middlewares
 * Remplace l'utilisation de 'any' par des types précis
 */

// Types pour uWebSockets.js
export interface UWSRequest {
    getMethod(): string;
    getUrl(): string;
    getQuery(): string;
    getParameter(index: number): string;
    getHeader(key: string): string;
    forEach(callback: (key: string, value: string) => void): void;
}

export interface UWSResponse {
    writeStatus(status: string): UWSResponse;
    writeHeader(key: string, value: string): UWSResponse;
    end(body?: string): void;
    onData(callback: (chunk: ArrayBuffer, isLast: boolean) => void): void;
    onAborted(callback: () => void): void;
}

// Types pour le contexte des middlewares
export interface RequestData {
    [key: string]: unknown;
}

export interface RequestBody {
    [key: string]: unknown;
}

export interface RequestHeaders {
    [key: string]: string;
}

export interface RequestParams {
    [key: string]: string;
}

export interface RequestQuery {
    [key: string]: string;
}

// Type pour les loggers
export interface Logger {
    debug(message: string, meta?: Record<string, unknown>): void;
    info(message: string, meta?: Record<string, unknown>): void;
    warn(message: string, meta?: Record<string, unknown>): void;
    error(message: string, meta?: Record<string, unknown>): void;
}

// Type pour les erreurs avec status code
export interface HttpError extends Error {
    statusCode?: number;
    validationErrors?: string[];
}

// Types pour les options d'authentification
export interface AuthenticationOptions {
    roles?: string[];
    requireAuth?: boolean;
    checkAllRoles?: boolean;
}

// Type pour les contexts d'erreur d'authentification
export interface AuthErrorContext {
    url?: string;
    method?: string;
    userId?: number;
    userRoles?: string[];
    requiredRoles?: string[];
    timestamp: string;
}

// Type pour les contextes d'erreur généraux
export interface GeneralErrorContext {
    error: HttpError;
    request: UWSRequest;
    response: UWSResponse;
    logger?: Logger;
    meta?: Record<string, unknown>;
}

// Type pour la fonction middleware
export type Middleware = (req: UWSRequest, res: UWSResponse, next?: () => void) => void | Promise<void>;

// Type pour les factory functions
export type MiddlewareFactory<T extends Middleware = Middleware> = (...args: unknown[]) => T;

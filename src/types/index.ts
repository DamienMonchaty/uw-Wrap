import * as uWS from 'uWebSockets.js';

export interface WebSocketHandler {
    onOpen?: (ws: uWS.WebSocket<any>) => void;
    onMessage?: (ws: uWS.WebSocket<any>, message: string | Buffer, flags: { binary: boolean }) => void;
    onClose?: (ws: uWS.WebSocket<any>, code: number, reason: string) => void;
}

export interface HttpHandler {
    (req: uWS.HttpRequest, res: uWS.HttpResponse): void | Promise<void>;
}

export interface DatabaseRecord {
    [key: string]: any;
}

export interface ErrorResponse {
    error: string;
    code: string;
    timestamp: Date;
    details?: any;
    stack?: string;           // For development/debugging
    severity?: string;        // Error severity level
    category?: string;        // Error category
    requestId?: string;       // Request tracking ID
}

export interface JWTPayload {
    userId: string;
    email?: string;
    role?: string;
    iat?: number;
    exp?: number;
}

/**
 * JwtService - Single responsibility: JWT token operations
 * Extracted from AuthenticationMiddleware for better separation of concerns
 */

import { Service } from "../core/AutoRegistration";

export interface JwtPayload {
    userId: number;
    email: string;
    role?: string;
    roles?: string[];
    iat?: number;
    exp?: number;
    [key: string]: unknown;
}

export interface JwtVerificationResult {
    success: boolean;
    payload?: JwtPayload;
    error?: string;
    errorType?: 'EXPIRED' | 'INVALID' | 'MALFORMED' | 'MISSING';
}

/**
 * JWT Service - Handles only JWT-related operations
 */
@Service('JwtService')
export class JwtService {
    constructor(
        private secret: string,
        private defaultExpiresIn: string = '1h'
    ) {}

    /**
     * Generate a JWT token
     */
    generateToken(payload: Partial<JwtPayload>, expiresIn?: string): string {
        const jwt = require('jsonwebtoken');
        return jwt.sign(payload, this.secret, {
            expiresIn: expiresIn || this.defaultExpiresIn
        });
    }

    /**
     * Verify and decode a JWT token
     * Returns structured result instead of throwing
     */
    verifyToken(token: string): JwtVerificationResult {
        try {
            const jwt = require('jsonwebtoken');
            const payload = jwt.verify(token, this.secret) as JwtPayload;
            
            return {
                success: true,
                payload
            };
        } catch (error: unknown) {
            return this.handleJwtError(error);
        }
    }

    /**
     * Decode token without verification (for debugging)
     */
    decodeTokenUnsafe(token: string): JwtPayload | null {
        try {
            const jwt = require('jsonwebtoken');
            return jwt.decode(token) as JwtPayload;
        } catch {
            return null;
        }
    }

    /**
     * Check if token is expired without throwing
     */
    isTokenExpired(token: string): boolean {
        const decoded = this.decodeTokenUnsafe(token);
        if (!decoded?.exp) return true;
        
        return Date.now() >= decoded.exp * 1000;
    }

    /**
     * Extract token from Authorization header
     */
    extractTokenFromHeader(authHeader: string): { success: boolean; token?: string; error?: string } {
        if (!authHeader) {
            return {
                success: false,
                error: 'Missing authorization header'
            };
        }

        if (!authHeader.startsWith('Bearer ')) {
            return {
                success: false,
                error: 'Invalid authorization header format. Expected "Bearer <token>"'
            };
        }

        const token = authHeader.substring(7).trim();
        if (!token) {
            return {
                success: false,
                error: 'Empty token in authorization header'
            };
        }

        return {
            success: true,
            token
        };
    }

    /**
     * Handle JWT-specific errors with proper categorization
     */
    private handleJwtError(error: unknown): JwtVerificationResult {
        const message = (error as Error).message || 'Unknown JWT error';

        if (message.includes('jwt expired')) {
            return {
                success: false,
                error: 'Token has expired',
                errorType: 'EXPIRED'
            };
        }

        if (message.includes('jwt malformed') || 
            message.includes('invalid token') ||
            message.includes('jwt signature is required')) {
            return {
                success: false,
                error: 'Token is malformed or invalid',
                errorType: 'MALFORMED'
            };
        }

        if (message.includes('invalid signature') ||
            message.includes('jwt signature') ||
            message.includes('invalid algorithm')) {
            return {
                success: false,
                error: 'Token signature is invalid',
                errorType: 'INVALID'
            };
        }

        if (message.includes('jwt audience invalid') ||
            message.includes('jwt issuer invalid') ||
            message.includes('jwt not active')) {
            return {
                success: false,
                error: 'Token validation failed',
                errorType: 'INVALID'
            };
        }

        // Unknown JWT error
        return {
            success: false,
            error: 'Token validation failed',
            errorType: 'INVALID'
        };
    }
}

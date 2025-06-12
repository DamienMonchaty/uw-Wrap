import jwt from 'jsonwebtoken';
import { JWTPayload } from '../types';
import { AppError, ErrorCode, ErrorDetails } from '../utils/errorHandler';

export class JWTManager {
    private secretKey: string;
    private expiresIn: string | number;

    constructor(secretKey: string, expiresIn: string | number = '24h') {
        this.secretKey = secretKey;
        this.expiresIn = expiresIn;
    }

    generateToken(payload: JWTPayload): string {
        try {
            // Use compatible typing for jsonwebtoken options
            const options = { 
                expiresIn: this.expiresIn as any
            };
            return jwt.sign(payload, this.secretKey, options);
        } catch (error) {
            const details: ErrorDetails = {
                operation: 'generateToken',
                originalError: error instanceof Error ? error.message : String(error)
            };
            throw new AppError('Failed to generate token', ErrorCode.INTERNAL_SERVER_ERROR, 500, details);
        }
    }

    verifyToken(token: string): JWTPayload {
        try {
            return jwt.verify(token, this.secretKey) as JWTPayload;
        } catch (error) {
            if (error instanceof jwt.TokenExpiredError) {
                throw new AppError('Token expired', ErrorCode.AUTHENTICATION_ERROR, 401);
            } else if (error instanceof jwt.JsonWebTokenError) {
                throw new AppError('Invalid token', ErrorCode.AUTHENTICATION_ERROR, 401);
            }
            
            const details: ErrorDetails = {
                operation: 'verifyToken',
                originalError: error instanceof Error ? error.message : String(error)
            };
            throw new AppError('Token verification failed', ErrorCode.AUTHENTICATION_ERROR, 401, details);
        }
    }

    refreshToken(token: string): string {
        try {
            const decoded = jwt.verify(token, this.secretKey, { ignoreExpiration: true }) as JWTPayload;
            
            // Remove iat and exp from payload for new token
            const { iat, exp, ...payload } = decoded;
            
            return this.generateToken(payload);
        } catch (error) {
            const details: ErrorDetails = {
                operation: 'refreshToken',
                originalError: error instanceof Error ? error.message : String(error)
            };
            throw new AppError('Failed to refresh token', ErrorCode.AUTHENTICATION_ERROR, 401, details);
        }
    }

    extractTokenFromHeader(authHeader: string): string {
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new AppError('Invalid authorization header format', ErrorCode.AUTHENTICATION_ERROR, 401);
        }
        
        return authHeader.substring(7); // Remove 'Bearer ' prefix
    }
}

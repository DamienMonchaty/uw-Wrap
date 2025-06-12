/**
 * ServerEventManager - Manages server events and hooks
 * Single Responsibility: Server event lifecycle management
 */

import { Logger } from '../../utils/logger';
import { ErrorHandler } from '../../utils/errorHandler';

export type ServerEventType = 'starting' | 'started' | 'stopping' | 'stopped' | 'error';
export type ServerEventHandler = (event: ServerEventType, data?: any) => void | Promise<void>;

export interface ServerEvent {
    type: ServerEventType;
    timestamp: Date;
    data?: any;
}

/**
 * Server Event Manager - Handles server lifecycle events
 */
export class ServerEventManager {
    private eventHandlers = new Map<ServerEventType, ServerEventHandler[]>();
    private events: ServerEvent[] = [];
    private logger: Logger;
    private errorHandler: ErrorHandler;

    constructor(logger: Logger, errorHandler: ErrorHandler) {
        this.logger = logger;
        this.errorHandler = errorHandler;
    }

    /**
     * Register an event handler
     */
    on(eventType: ServerEventType, handler: ServerEventHandler): void {
        if (!this.eventHandlers.has(eventType)) {
            this.eventHandlers.set(eventType, []);
        }
        this.eventHandlers.get(eventType)!.push(handler);
    }

    /**
     * Remove an event handler
     */
    off(eventType: ServerEventType, handler: ServerEventHandler): void {
        const handlers = this.eventHandlers.get(eventType);
        if (handlers) {
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }

    /**
     * Emit an event
     */
    async emit(eventType: ServerEventType, data?: any): Promise<void> {
        const event: ServerEvent = {
            type: eventType,
            timestamp: new Date(),
            data
        };

        // Store event
        this.events.push(event);

        // Keep only last 100 events
        if (this.events.length > 100) {
            this.events.shift();
        }

        // Execute handlers
        const handlers = this.eventHandlers.get(eventType) || [];
        
        for (const handler of handlers) {
            try {
                await handler(eventType, data);
            } catch (error) {
                this.logger.error(`Error in ${eventType} event handler:`, error);
                // Don't rethrow to prevent one handler from breaking others
            }
        }

        // Log important events
        if (['starting', 'started', 'stopping', 'stopped', 'error'].includes(eventType)) {
            this.logger.info(`Server event: ${eventType}`, { data });
        }
    }

    /**
     * Get recent events
     */
    getRecentEvents(limit: number = 10): ServerEvent[] {
        return this.events.slice(-limit);
    }

    /**
     * Clear event history
     */
    clearEvents(): void {
        this.events = [];
    }

    /**
     * Get event handler count for a specific event type
     */
    getHandlerCount(eventType: ServerEventType): number {
        return this.eventHandlers.get(eventType)?.length || 0;
    }

    /**
     * Check if there are any handlers for an event type
     */
    hasHandlers(eventType: ServerEventType): boolean {
        return this.getHandlerCount(eventType) > 0;
    }
}

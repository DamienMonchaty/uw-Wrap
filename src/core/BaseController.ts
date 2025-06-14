/**
 * BaseController - Simplified controller base class
 * Automatically injects common dependencies and provides utility methods
 */

import { ErrorHandler } from '../utils/errorHandler';
import { UWebSocketWrapper } from './ServerWrapper';

export abstract class BaseController {
    protected errorHandler!: ErrorHandler;
    protected server?: UWebSocketWrapper;

    constructor() {
        // Dependencies will be injected by the DI container
        // No default initialization here
    }

    /**
     * Set dependencies - called by the DI container
     */
    setDependencies(errorHandler: ErrorHandler, server?: UWebSocketWrapper) {
        this.errorHandler = errorHandler;
        if (server) this.server = server;
    }
}

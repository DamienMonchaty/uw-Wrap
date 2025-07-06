/**
 * uW-Wrap Test Server for Benchmarking
 * Minimal setup for maximum performance testing
 */

import { UWebSocketWrapper } from '../../src/core/ServerWrapper';
import { Logger } from '../../src/utils/logger';
import { ErrorHandler } from '../../src/utils/errorHandler';

async function startBenchmarkServer() {
    // Create required dependencies
    const logger = new Logger();
    const errorHandler = new ErrorHandler(logger);
    
    // Create wrapper directly
    const server = new UWebSocketWrapper(3001, logger, errorHandler);

    // Test data
    const testData = {
        message: 'Hello World',
        timestamp: Date.now(),
        data: Array.from({ length: 100 }, (_, i) => ({ id: i, value: `item-${i}` }))
    };

    // Add routes directly to the server
    server.addHttpHandler('get', '/api/hello', async (req: any, res: any) => {
        const response = { message: 'Hello World' };
        res.writeHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(response));
    });

    server.addHttpHandler('get', '/api/json', async (req: any, res: any) => {
        res.writeHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(testData));
    });

    server.addHttpHandler('get', '/api/query', async (req: any, res: any) => {
        const query = req.getQuery();
        const result = {
            query: Object.fromEntries(new URLSearchParams(query).entries()),
            timestamp: Date.now()
        };
        res.writeHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(result));
    });

    server.addHttpHandler('post', '/api/echo', async (req: any, res: any) => {
        let body = '';
        
        res.onData((chunk: ArrayBuffer, isLast: boolean) => {
            body += Buffer.from(chunk).toString();
            if (isLast) {
                try {
                    const parsed = JSON.parse(body);
                    const result = {
                        received: parsed,
                        timestamp: Date.now()
                    };
                    res.writeHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify(result));
                } catch (e) {
                    const result = {
                        received: body,
                        timestamp: Date.now()
                    };
                    res.writeHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify(result));
                }
            }
        });

        res.onAborted(() => {
            // Handle aborted request
        });
    });

    // Start the server
    await server.start();
    console.log('uW-Wrap benchmark server running on port 3001');
    
    return server;
}

if (require.main === module) {
    startBenchmarkServer().catch(console.error);
}

export { startBenchmarkServer };

/**
 * Fastify Test Server for Benchmarking
 */

const fastify = require('fastify')({ logger: false });

// Test data
const testData = {
    message: 'Hello World',
    timestamp: Date.now(),
    data: Array.from({ length: 100 }, (_, i) => ({ id: i, value: `item-${i}` }))
};

async function startFastifyServer() {
    // Routes
    fastify.get('/api/hello', async (request, reply) => {
        return { message: 'Hello World' };
    });
    
    fastify.get('/api/json', async (request, reply) => {
        return testData;
    });
    
    fastify.get('/api/query', async (request, reply) => {
        return {
            query: request.query,
            timestamp: Date.now()
        };
    });
    
    fastify.post('/api/echo', async (request, reply) => {
        return {
            received: request.body,
            timestamp: Date.now()
        };
    });
    
    try {
        await fastify.listen({ port: 3003 });
        console.log('Fastify benchmark server running on port 3003');
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
}

if (require.main === module) {
    startFastifyServer();
}

module.exports = { startFastifyServer };

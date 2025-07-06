/**
 * Koa.js Test Server for Benchmarking
 */

const Koa = require('koa');
const Router = require('koa-router');
const bodyParser = require('koa-bodyparser');

// Test data
const testData = {
    message: 'Hello World',
    timestamp: Date.now(),
    data: Array.from({ length: 100 }, (_, i) => ({ id: i, value: `item-${i}` }))
};

function startKoaServer() {
    const app = new Koa();
    const router = new Router();
    
    // Middleware
    app.use(bodyParser());
    
    // Routes
    router.get('/api/hello', (ctx) => {
        ctx.body = { message: 'Hello World' };
    });
    
    router.get('/api/json', (ctx) => {
        ctx.body = testData;
    });
    
    router.get('/api/query', (ctx) => {
        ctx.body = {
            query: ctx.query,
            timestamp: Date.now()
        };
    });
    
    router.post('/api/echo', (ctx) => {
        ctx.body = {
            received: ctx.request.body,
            timestamp: Date.now()
        };
    });
    
    app.use(router.routes());
    app.use(router.allowedMethods());
    
    const server = app.listen(3004, () => {
        console.log('Koa benchmark server running on port 3004');
    });
    
    return server;
}

if (require.main === module) {
    startKoaServer();
}

module.exports = { startKoaServer };

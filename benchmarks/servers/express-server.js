/**
 * Express.js Test Server for Benchmarking
 */

const express = require('express');

// Test data
const testData = {
    message: 'Hello World',
    timestamp: Date.now(),
    data: Array.from({ length: 100 }, (_, i) => ({ id: i, value: `item-${i}` }))
};

function startExpressServer() {
    const app = express();
    
    // Middleware
    app.use(express.json());
    app.disable('x-powered-by');
    
    // Routes
    app.get('/api/hello', (req, res) => {
        res.json({ message: 'Hello World' });
    });
    
    app.get('/api/json', (req, res) => {
        res.json(testData);
    });
    
    app.get('/api/query', (req, res) => {
        res.json({
            query: req.query,
            timestamp: Date.now()
        });
    });
    
    app.post('/api/echo', (req, res) => {
        res.json({
            received: req.body,
            timestamp: Date.now()
        });
    });
    
    const server = app.listen(3002, () => {
        console.log('Express benchmark server running on port 3002');
    });
    
    return server;
}

if (require.main === module) {
    startExpressServer();
}

module.exports = { startExpressServer };

import { BlitzJS } from '../src';

new BlitzJS()
  .get('/', 'Hello BlitzJS!')
  .get('/json', { message: 'Hello World', framework: 'BlitzJS' })
  .get('/user/:id', (ctx) => {
    return {
      id: ctx.params.id,
      name: `User ${ctx.params.id}`,
      framework: 'BlitzJS'
    };
  })
  .get('/health', () => ({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  }))
  .post('/echo', (ctx) => {
    return {
      method: ctx.req.getMethod(),
      url: ctx.req.getUrl(),
      echo: 'This is BlitzJS!'
    };
  })
  .listen(3000, (token) => {
    if (token) {
      console.log('🚀 BlitzJS is running on http://localhost:3000');
      console.log('📍 Endpoints:');
      console.log('   GET  / - Simple string');
      console.log('   GET  /json - JSON object');
      console.log('   GET  /user/:id - Dynamic route');
      console.log('   GET  /health - Health check');
      console.log('   POST /echo - Echo endpoint');
    }
  });

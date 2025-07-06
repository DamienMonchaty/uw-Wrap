import { BlitzJS, Blitz } from '../src';

// Create a user sub-application
export const user = new BlitzJS({ prefix: '/user' })
  .get('/:id', (ctx) => {
    return {
      id: ctx.params.id,
      name: `User ${ctx.params.id}`,
      framework: 'BlitzJS'
    };
  })
  .get('/:id/profile', (ctx) => {
    return {
      id: ctx.params.id,
      profile: `Profile of user ${ctx.params.id}`,
      email: `user${ctx.params.id}@example.com`
    };
  })
  .post('/', (ctx) => {
    return {
      message: 'User created',
      endpoint: '/user'
    };
  });

// Create an admin sub-application  
const admin = new BlitzJS({ prefix: '/admin' })
  .get('/dashboard', () => ({
    page: 'admin dashboard',
    authenticated: true
  }))
  .get('/users', () => ({
    users: ['user1', 'user2', 'user3'],
    total: 3
  }));

// Main application
new BlitzJS()
  .get('/', 'Hello BlitzJS with sub-apps!')
  .get('/health', () => ({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  }))
  .use(user)           // Mount user sub-app
  .use(admin)          // Mount admin sub-app
  .post('/echo', (ctx) => {
    return {
      method: ctx.req.getMethod(),
      url: ctx.req.getUrl(),
      echo: 'This is BlitzJS with modular apps!'
    };
  })
  .listen(3000, (token) => {
    if (token) {
      console.log('🚀 BlitzJS is running on http://localhost:3000');
      console.log('📍 Endpoints:');
      console.log('   GET  / - Simple string');
      console.log('   GET  /health - Health check');
      console.log('   GET  /user/:id - User details');
      console.log('   GET  /user/:id/profile - User profile');
      console.log('   POST /user - Create user');
      console.log('   GET  /admin/dashboard - Admin dashboard');
      console.log('   GET  /admin/users - List users');
      console.log('   POST /echo - Echo endpoint');
    }
  });

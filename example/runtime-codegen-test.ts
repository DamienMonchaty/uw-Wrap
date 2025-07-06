import { BlitzJS } from '../src';

console.log('🚀 Testing BlitzJS with Runtime Code Generation (enabled by default)');

// L'application BlitzJS avec génération de code activée par défaut
const app = new BlitzJS();

app
  // 🚀 String handler - sera compilé en handler ultra-rapide
  .get('/', 'Hello BlitzJS with Runtime Code Generation!')
  
  // 🚀 JSON handler - sera compilé en handler JSON ultra-rapide  
  .get('/health', { 
    status: 'ok', 
    codeGeneration: 'enabled',
    performance: 'ultra-fast',
    timestamp: new Date().toISOString()
  })
  
  // 🚀 Function handler statique - sera compilé avec optimisations
  .get('/info', () => ({
    framework: 'BlitzJS',
    feature: 'Runtime Code Generation',
    version: '1.0.0'
  }))
  
  // 🚀 Function handler dynamique - sera compilé avec extraction de paramètres optimisée
  .get('/user/:id', (ctx) => ({
    id: ctx.params.id,
    name: `User ${ctx.params.id}`,
    compiled: true,
    fastPath: 'runtime-generated'
  }))
  
  // 🚀 Nested dynamic route - sera compilé avec extraction multi-paramètres
  .get('/user/:id/posts/:postId', (ctx) => ({
    userId: ctx.params.id,
    postId: ctx.params.postId,
    title: `Post ${ctx.params.postId} by User ${ctx.params.id}`,
    optimized: true
  }))
  
  // 🚀 POST handler avec logique plus complexe
  .post('/api/users', (ctx) => ({
    message: 'User created successfully',
    method: ctx.req.getMethod(),
    url: ctx.req.getUrl(),
    timestamp: Date.now(),
    compiled: true
  }))
  
  .listen(3005, (token) => {
    if (token) {
      console.log('\n🎯 Test these ultra-optimized endpoints:');
      console.log('   curl http://localhost:3005/ - String (compiled)');
      console.log('   curl http://localhost:3005/health - JSON (compiled)');
      console.log('   curl http://localhost:3005/info - Function static (compiled)');
      console.log('   curl http://localhost:3005/user/123 - Function dynamic (compiled)');
      console.log('   curl http://localhost:3005/user/123/posts/456 - Nested dynamic (compiled)');
      console.log('   curl -X POST http://localhost:3005/api/users - POST (compiled)');
      console.log('\n⚡ All handlers have been compiled to ultra-fast code!');
    }
  });

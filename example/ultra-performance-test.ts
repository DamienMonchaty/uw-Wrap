import { BlitzJS } from '../src';

console.log('🔥 Testing BlitzJS ULTRA-PERFORMANCE MODE');
console.log('🎯 Target: 500,000+ req/s for static routes, 300,000+ req/s for dynamic routes');

const app = new BlitzJS();

// Mix de routes statiques et dynamiques pour tester les optimisations
app
  // 🚀 Routes statiques (O(1) HashMap lookup)
  .get('/', 'Ultra-Fast BlitzJS - Static Route Optimized!')
  .get('/health', { 
    status: 'ultra-fast', 
    optimization: 'O(1) HashMap lookup',
    headers: 'pre-computed',
    performance: '500,000+ req/s target',
    timestamp: Date.now()
  })
  .get('/static1', 'Static Route 1 - Compiled!')
  .get('/static2', { message: 'Static Route 2 - JSON Pre-serialized!' })
  .get('/static3', 'Static Route 3 - Headers Pre-computed!')
  .get('/benchmark', {
    framework: 'BlitzJS',
    mode: 'ULTRA-PERFORMANCE',
    features: [
      'O(1) static route lookup',
      'Optimized regex for dynamic routes',
      'Pre-computed headers',
      'Runtime code generation',
      'Ultra-fast router compilation'
    ]
  })
  
  // 🔥 Routes dynamiques (optimized regex + parameter extraction)
  .get('/user/:id', (ctx) => ({ 
    userId: ctx.params.id, 
    message: 'Ultra-fast dynamic route!',
    optimization: 'Compiled regex + parameter extraction',
    performance: '300,000+ req/s target'
  }))
  .get('/user/:id/profile', (ctx) => ({ 
    userId: ctx.params.id,
    profile: `Ultra-optimized profile for user ${ctx.params.id}`,
    compiled: true,
    headers_precomputed: true
  }))
  .get('/api/:version/posts/:postId', (ctx) => ({
    version: ctx.params.version,
    postId: ctx.params.postId,
    title: `Post ${ctx.params.postId} (API v${ctx.params.version})`,
    optimization: 'Advanced regex + multi-parameter extraction',
    ultra_fast: true
  }))
  .get('/product/:category/:id/reviews', (ctx) => ({
    category: ctx.params.category,
    productId: ctx.params.id,
    reviews: `Reviews for ${ctx.params.category} product ${ctx.params.id}`,
    nested_params: true,
    compiled_handler: true
  }))
  
  // 🚀 Routes POST avec handlers compilés
  .post('/api/users', (ctx) => ({
    message: 'User created with ultra-fast handler',
    method: ctx.req.getMethod(),
    url: ctx.req.getUrl(),
    timestamp: Date.now(),
    performance_mode: 'ULTRA-FAST',
    compiled: true
  }))
  .post('/echo', (ctx) => ({
    echo: 'Ultra-fast POST handler',
    optimized: true,
    headers_precomputed: true,
    router_compiled: true
  }))
  
  .listen(3006, (token) => {
    if (token) {
      console.log('\n🎯 ULTRA-PERFORMANCE TEST ENDPOINTS:');
      console.log('\n📊 STATIC ROUTES (O(1) HashMap - Target: 500k+ req/s):');
      console.log('   curl http://localhost:3006/ - String static');
      console.log('   curl http://localhost:3006/health - JSON static');
      console.log('   curl http://localhost:3006/benchmark - Features JSON');
      console.log('   curl http://localhost:3006/static1 - String static');
      console.log('   curl http://localhost:3006/static2 - JSON static');
      
      console.log('\n🔥 DYNAMIC ROUTES (Optimized Regex - Target: 300k+ req/s):');
      console.log('   curl http://localhost:3006/user/123 - Single param');
      console.log('   curl http://localhost:3006/user/456/profile - Nested route');
      console.log('   curl http://localhost:3006/api/v2/posts/789 - Multi-param');
      console.log('   curl http://localhost:3006/product/electronics/999/reviews - Complex nested');
      
      console.log('\n⚡ POST ROUTES (Compiled Handlers):');
      console.log('   curl -X POST http://localhost:3006/api/users - POST compiled');
      console.log('   curl -X POST http://localhost:3006/echo - POST optimized');
      
      console.log('\n🚀 All handlers compiled with ULTRA-PERFORMANCE optimizations!');
      console.log('🎯 Ready for high-performance benchmarking!');
    }
  });

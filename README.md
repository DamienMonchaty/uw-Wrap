# BlitzJS ⚡

Ultra-fast HTTP framework with Elysia-like API built on uWebSockets.js

## Features

- ⚡ **Lightning Fast** - Built on uWebSockets.js, one of the fastest HTTP servers
- 🎯 **Elysia-like API** - Clean, chainable syntax inspired by Elysia
- 🔧 **TypeScript First** - Full TypeScript support with excellent type inference  
- 📦 **Zero Dependencies** - Only uWebSockets.js as peer dependency
- 🚀 **Auto Response** - Automatic JSON/string response handling

## Installation

```bash
npm install blitzjs
```

## Quick Start

```typescript
import { BlitzJS } from 'blitzjs';

new BlitzJS()
  .get('/', 'Hello BlitzJS!')
  .get('/json', { message: 'Auto JSON response!' })
  .get('/user/:id', (ctx) => ({ 
    id: ctx.params.id, 
    name: `User ${ctx.params.id}` 
  }))
  .listen(3000);
```

## API

### Simple Responses

```typescript
// String response
.get('/', 'Hello World!')

// JSON response  
.get('/data', { key: 'value' })

// Function response
.get('/time', () => new Date().toISOString())

// Dynamic response
.get('/user/:id', (ctx) => ({ id: ctx.params.id }))
```

### HTTP Methods

```typescript
new BlitzJS()
  .get('/users', () => getAllUsers())
  .post('/users', (ctx) => createUser(ctx.body))
  .put('/users/:id', (ctx) => updateUser(ctx.params.id))
  .delete('/users/:id', (ctx) => deleteUser(ctx.params.id))
  .listen(3000);
```

### Context

Route handlers receive a context object:

```typescript
interface RouteContext {
  req: HttpRequest;      // uWebSockets.js request
  res: HttpResponse;     // uWebSockets.js response  
  params: Record<string, string>;  // Route parameters
  query: Record<string, string>;   // Query parameters
  body?: any;           // Request body (if parsed)
}
```

### Middleware

```typescript
import { BlitzJS } from 'blitzjs';

const app = new BlitzJS()
  .use(async (ctx, next) => {
    console.log(`${ctx.req.getMethod()} ${ctx.req.getUrl()}`);
    await next();
  })
  .get('/', 'Hello with middleware!')
  .listen(3000);
```

### Factory Function

```typescript
import { Blitz } from 'blitzjs';

// Use the factory function for a more functional approach
const app = Blitz()
  .get('/', 'Hello from factory!')
  .listen(3000);
```

## Performance

BlitzJS leverages uWebSockets.js to deliver exceptional performance:

- **High Throughput** - Hundreds of thousands of requests per second
- **Low Latency** - Minimal response times
- **Memory Efficient** - Low memory footprint
- **CPU Efficient** - Optimized for modern JavaScript engines

## Examples

See the `example/` directory:

- `blitz-style.ts` - Complete BlitzJS example with various features

## License

MIT

---

**BlitzJS** - When you need speed ⚡

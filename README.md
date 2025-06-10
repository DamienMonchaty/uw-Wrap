# 🚀 uW-Wrap - High-Performance Node.js Framework

> ⚠️ **Development Status**: This project is currently under active development. APIs may change and some features are experimental.

A blazing-fast TypeScript wrapper for uWebSockets.js, designed to deliver exceptional performance while maintaining developer productivity and code clarity.

## 📊 Performance Benchmarks

uW-Wrap significantly outperforms popular Node.js frameworks:

| Framework | Avg RPS | Avg Latency | Performance vs Express |
|-----------|---------|-------------|----------------------|
| 🥇 **uW-Wrap** | **35,437** | **2.53ms** | **5.8x faster** |
| 🥈 Fastify | 20,787 | 4.48ms | 3.4x faster |
| 🥉 Koa | 15,434 | 6.13ms | 2.5x faster |
| Express | 6,084 | 16.06ms | baseline |

*Benchmark details: 100 concurrent connections, 10-second tests across multiple endpoints*

## ✨ Key Features

- 🚀 **Exceptional Performance** - Built on uWebSockets.js for maximum speed
- 🎯 **Type-Safe** - Full TypeScript support with comprehensive type definitions
- 🏗️ **Modern Architecture** - Clean, modular design with dependency injection
- 🔒 **Production Ready** - Built-in authentication, validation, and error handling
- 📊 **Monitoring** - Integrated metrics, health checks, and logging
- 🗄️ **Database Support** - MySQL and SQLite providers with repository pattern
- 🔧 **Developer Experience** - Hot reload, debugging tools, and comprehensive docs

## 🚀 Quick Start

### Installation
```bash
npm install uw-wrap
# or
bun install uw-wrap
```

### Basic Server Setup
```typescript
import { ApplicationBootstrap } from 'uw-wrap';

const config = {
    port: 3000,
    jwtSecret: 'your-secret-key',
    database: {
        type: 'sqlite',
        sqlite: { file: './app.db' }
    }
};

const app = new ApplicationBootstrap(config);
await app.start();
console.log('🚀 Server running on port 3000');
```

### Route Handlers with Decorators
```typescript
import { Route, GET, POST, Auth } from 'uw-wrap/decorators';

@Controller('UserController')
@Route('/api/users')
export class UserController {
    
    @GET('/')
    async getUsers() {
        return { users: [] };
    }
    
    @POST('/')
    @Auth(['admin'])
    async createUser(req: any) {
        return { message: 'User created', data: req.body };
    }
}
```

## 📚 Documentation

### 🚀 [Setup & Configuration](./docs/setup/)
- **[MySQL Configuration](./docs/setup/MYSQL_CONFIG.md)** - Production database setup guide
- **[SQLite Configuration](./docs/setup/SQLITE_CONFIG.md)** - Development database setup guide

### 📖 [Usage Guides](./docs/guides/)
- **[Quick Start Guide](./docs/guides/QUICK_START_GUIDE.md)** - Get started in minutes
- **[Wrapper Usage Guide](./docs/guides/WRAPPER_USAGE_GUIDE.md)** - Comprehensive usage guide
- **[Repository Guide](./docs/guides/REPOSITORY_GUIDE.md)** - Database repository patterns

### 🏗️ [Architecture](./docs/architecture/)
- **[Error Handler Improvements](./docs/architecture/ERROR_HANDLER_IMPROVEMENTS.md)** - Error handling system

### 📑 [Reference](./docs/reference/)
- **[Performance Benchmarks](./docs/reference/PERFORMANCE_BENCHMARKS.md)** - Detailed performance analysis
- **[Development Status](./docs/reference/DEVELOPMENT_STATUS.md)** - Project roadmap and status

## 🎯 Core Components

### Server Wrapper
High-performance HTTP server built on uWebSockets.js:
```typescript
import { UWebSocketWrapper } from 'uw-wrap/core';

const server = new UWebSocketWrapper(3000, logger, errorHandler);
server.addHttpHandler('get', '/api/health', healthHandler);
await server.start();
```

### Auto-Discovery
Automatic route and service registration:
```typescript
// Automatically discovers and registers all controllers
const bootstrap = new ApplicationBootstrap(config);
await bootstrap.start({ enableAutoDiscovery: true });
```

### Database Repositories
Type-safe database operations:
```typescript
import { CrudRepository } from 'uw-wrap/database';

class UserRepository extends CrudRepository<User> {
    constructor(provider: DatabaseProvider) {
        super(provider, 'users');
    }
    
    async findByEmail(email: string): Promise<User | null> {
        return this.findOne({ email });
    }
}
```

## 🛠️ Development

### Setup Development Environment
```bash
git clone <repository-url>
cd uW-Wrap
npm install
npm run dev
```

### Available Scripts
```bash
npm start               # Start production server
npm run dev             # Start development server with hot reload
npm run debug           # Start with debugging enabled
npm test                # Run test suite
```

## 🗄️ Database Support

### SQLite (Development)
```typescript
const config = {
    database: {
        type: 'sqlite',
        sqlite: { file: './development.db' }
    }
};
```

### MySQL (Production)
```typescript
const config = {
    database: {
        type: 'mysql',
        mysql: {
            host: 'localhost',
            user: 'app_user',
            password: 'secure_password',
            database: 'production_db'
        }
    }
};
```

## 🔧 Configuration

Complete configuration example:
```typescript
const config = {
    port: 3000,
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: '24h',
    enableLogging: true,
    logLevel: 'info',
    database: {
        type: 'mysql',
        mysql: {
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            connectionLimit: 10
        }
    },
    cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE']
    }
};
```

## 🚨 Development Status

This framework is under active development. Current focus areas:

- ✅ **Core Performance** - Optimized for maximum throughput
- ✅ **Developer Experience** - Clean APIs and comprehensive docs  
- ✅ **Production Logging** - Optimized logging for deployment
- ✅ **Benchmarking Suite** - Performance validation tools
- 🔄 **Advanced Middleware** - Enhanced request/response processing
- 🔄 **WebSocket Support** - Real-time communication features
- 🔄 **Comprehensive Testing** - Full test coverage
- 📋 **Plugin System** - Extensible architecture

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests for any improvements.

## 📄 License

This project is licensed under the ISC License - see the LICENSE file for details.

---

## 📞 Support

For questions or issues, refer to the appropriate documentation sections above, particularly:
- Start with the [Wrapper Usage Guide](./docs/guides/WRAPPER_USAGE_GUIDE.md) for basic usage
- Check [Repository Guide](./docs/guides/REPOSITORY_GUIDE.md) for data access patterns
- Review [Error Handler Improvements](./docs/architecture/ERROR_HANDLER_IMPROVEMENTS.md) for error handling

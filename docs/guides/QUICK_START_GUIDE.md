# 🚀 Quick Start Guide

## Prerequisites

- Node.js 18+ or Bun 1.0+
- TypeScript 5.0+
- Basic knowledge of TypeScript/JavaScript

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd uW-Wrap

# Install dependencies
npm install
# or
bun install
```

## Basic Server Setup

### 1. Simple Server

Create a basic server with minimal configuration:

```typescript
// server.ts
import { ApplicationBootstrap } from './src/core/ApplicationBootstrap';

const config = {
    port: 3000,
    jwtSecret: 'your-secret-key',
    enableLogging: true
};

const app = new ApplicationBootstrap(config);

async function start() {
    await app.start();
    console.log('🚀 Server running on http://localhost:3000');
}

start().catch(console.error);
```

### 2. With Database

Add database support (SQLite for development):

```typescript
// server-with-db.ts
import { ApplicationBootstrap } from './src/core/ApplicationBootstrap';

const config = {
    port: 3000,
    jwtSecret: 'your-secret-key',
    database: {
        type: 'sqlite' as const,
        sqlite: {
            file: './app.db'
        }
    }
};

const app = new ApplicationBootstrap(config);
await app.start();
```

### 3. Production Configuration

For production with MySQL:

```typescript
// production-server.ts
import { ApplicationBootstrap } from './src/core/ApplicationBootstrap';

const config = {
    port: Number(process.env.PORT) || 3000,
    jwtSecret: process.env.JWT_SECRET!,
    jwtExpiresIn: '24h',
    enableLogging: true,
    logLevel: 'info',
    database: {
        type: 'mysql' as const,
        mysql: {
            host: process.env.DB_HOST!,
            user: process.env.DB_USER!,
            password: process.env.DB_PASSWORD!,
            database: process.env.DB_NAME!,
            connectionLimit: 10
        }
    }
};

const app = new ApplicationBootstrap(config);
await app.start();
```

## Creating Controllers

### Route Decorators

Use decorators for clean route definitions:

```typescript
// controllers/UserController.ts
import { Route, GET, POST, PUT, DELETE, Auth, Validate } from '../src/core/RouteDecorators';

@Controller('UserController')
@Route('/api/users')
export class UserController {
    
    // GET /api/users
    @GET('/')
    async getUsers() {
        return {
            success: true,
            data: [
                { id: 1, name: 'John Doe', email: 'john@example.com' },
                { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
            ]
        };
    }
    
    // GET /api/users/:id
    @GET('/:id')
    async getUser(req: any) {
        const id = req.getParameter(0);
        return {
            success: true,
            data: { id, name: 'John Doe', email: 'john@example.com' }
        };
    }
    
    // POST /api/users (requires authentication)
    @POST('/')
    @Auth(['admin', 'user'])
    async createUser(req: any) {
        const userData = req.body;
        return {
            success: true,
            message: 'User created successfully',
            data: { id: Date.now(), ...userData }
        };
    }
    
    // PUT /api/users/:id (admin only)
    @PUT('/:id')
    @Auth(['admin'])
    async updateUser(req: any) {
        const id = req.getParameter(0);
        const userData = req.body;
        return {
            success: true,
            message: 'User updated successfully',
            data: { id, ...userData }
        };
    }
    
    // DELETE /api/users/:id (admin only)
    @DELETE('/:id')
    @Auth(['admin'])
    async deleteUser(req: any) {
        const id = req.getParameter(0);
        return {
            success: true,
            message: 'User deleted successfully'
        };
    }
}
```

### Manual Route Registration

Alternative approach without decorators:

```typescript
// manual-routes.ts
import { UWebSocketWrapper } from './src/core/ServerWrapper';

const server = new UWebSocketWrapper(3000, logger, errorHandler);

// Simple GET route
server.addHttpHandler('get', '/api/health', async (req, res) => {
    res.writeHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ status: 'healthy', timestamp: Date.now() }));
});

// POST route with body parsing
server.addHttpHandler('post', '/api/data', async (req, res) => {
    let body = '';
    
    res.onData((chunk, isLast) => {
        body += Buffer.from(chunk).toString();
        if (isLast) {
            try {
                const data = JSON.parse(body);
                res.writeHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ 
                    received: data, 
                    timestamp: Date.now() 
                }));
            } catch (e) {
                res.writeStatus('400 Bad Request');
                res.end('Invalid JSON');
            }
        }
    });
});

await server.start();
```

## Database Usage

### Repository Pattern

Create type-safe database repositories:

```typescript
// repositories/UserRepository.ts
import { CrudRepository } from '../src/database/repositories/CrudRepository';
import { DatabaseProvider } from '../src/database/interfaces/DatabaseProvider';

interface User {
    id?: number;
    name: string;
    email: string;
    createdAt?: Date;
}

export class UserRepository extends CrudRepository<User> {
    constructor(provider: DatabaseProvider) {
        super(provider, 'users');
    }
    
    async findByEmail(email: string): Promise<User | null> {
        const users = await this.findMany({ email });
        return users[0] || null;
    }
    
    async createUser(userData: Omit<User, 'id' | 'createdAt'>): Promise<User> {
        return this.create({
            ...userData,
            createdAt: new Date()
        });
    }
    
    async updateUser(id: number, updates: Partial<User>): Promise<User | null> {
        return this.update(id, updates);
    }
    
    async deleteUser(id: number): Promise<boolean> {
        return this.delete(id);
    }
}
```

### Using Repositories in Controllers

```typescript
// controllers/UserController.ts
import { UserRepository } from '../repositories/UserRepository';
import { Container } from '../src/core/IocContainer';

@Route('/api/users')
export class UserController {
    private userRepo: UserRepository;
    
    constructor() {
        this.userRepo = Container.getInstance().get('UserRepository');
    }
    
    @GET('/')
    async getUsers() {
        const users = await this.userRepo.findAll();
        return { success: true, data: users };
    }
    
    @POST('/')
    @Auth(['admin'])
    async createUser(req: any) {
        const user = await this.userRepo.createUser(req.body);
        return { success: true, data: user };
    }
}
```

## Authentication

### JWT Setup

Configure JWT authentication:

```typescript
// auth/setup.ts
import { JWTManager } from '../src/auth/jwtManager';

const jwtManager = new JWTManager('your-secret-key', '24h');

// Generate token
const token = jwtManager.generateToken({ 
    userId: 123, 
    roles: ['user'] 
});

// Verify token
const payload = jwtManager.verifyToken(token);
console.log(payload); // { userId: 123, roles: ['user'], iat: ..., exp: ... }
```

### Protected Routes

Use the `@Auth` decorator for protected endpoints:

```typescript
@Route('/api/admin')
export class AdminController {
    
    @GET('/dashboard')
    @Auth(['admin']) // Only admin role
    async getDashboard() {
        return { data: 'Admin dashboard data' };
    }
    
    @GET('/users')
    @Auth(['admin', 'moderator']) // Multiple roles
    async getUsers() {
        return { data: 'User management data' };
    }
    
    @POST('/settings')
    @Auth() // Any authenticated user
    async updateSettings(req: any) {
        return { message: 'Settings updated' };
    }
}
```

## Environment Variables

Create a `.env` file for configuration:

```bash
# .env
NODE_ENV=development
PORT=3000
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=24h

# Database (MySQL)
DB_HOST=localhost
DB_USER=app_user
DB_PASSWORD=secure_password
DB_NAME=app_database

# Database (SQLite - for development)
DB_FILE=./development.db

# Logging
LOG_LEVEL=debug
ENABLE_LOGGING=true
```

## Development Scripts

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only server.ts",
    "start": "node dist/server.js",
    "build": "tsc",
    "debug": "ts-node --inspect-brk server.ts",
    "bench": "node benchmarks/simple-benchmark.js"
  }
}
```

## Running the Application

```bash
# Development (with hot reload)
npm run dev

# Production build
npm run build
npm start

# Debug mode
npm run debug

# Run benchmarks
npm run bench
```

## Testing

### Basic Health Check

Test your server is running:

```bash
curl http://localhost:3000/api/health
```

### API Testing

```bash
# GET request
curl http://localhost:3000/api/users

# POST request with JSON
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe","email":"john@example.com"}'

# Authenticated request
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/api/admin/dashboard
```

## Performance

Run benchmarks to see performance:

```bash
npm run bench:simple
```

Expected results show uW-Wrap significantly outperforming other frameworks:
- **35,000+ req/s** average throughput
- **Sub-3ms** average latency
- **5.8x faster** than Express

## Next Steps

1. **Explore Examples** - Check the `example/` directory for complete implementations
2. **Read Documentation** - Browse `docs/` for detailed guides
3. **Performance Testing** - Run benchmarks with your specific use case
4. **Production Deployment** - Configure proper logging and error handling

## Common Issues

### TypeScript Errors
Ensure you have compatible TypeScript version:
```bash
npm install -D typescript@^5.0.0
```

### Database Connection
For MySQL, ensure the database exists and credentials are correct:
```sql
CREATE DATABASE your_app_name;
GRANT ALL PRIVILEGES ON your_app_name.* TO 'app_user'@'localhost';
```

### Port Already in Use
Change the port in your configuration:
```typescript
const config = { port: 3001 }; // Different port
```

---

🎉 **You're ready to build high-performance applications with uW-Wrap!**

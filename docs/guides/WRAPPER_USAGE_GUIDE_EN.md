# uW-Wrap - Usage Guide

Complete usage guide for the TypeScript wrapper for uWebSockets.js.

## 🚀 Overview

uW-Wrap is a modern TypeScript wrapper that simplifies the use of uWebSockets.js by providing:

- **Simplified HTTP/WebSocket API** with complete typing
- **Abstract database system** (SQLite/MySQL)
- **Generic Repository pattern** for CRUD operations
- **Centralized error handling** and logging
- **Integrated JWT authentication**
- **IoC architecture** for dependency injection

## 📁 Wrapper Structure (`src/`)

```
src/
├── core/
│   ├── uWebSocketWrapper.ts    # Main uWS wrapper
│   ├── BaseHandler.ts          # Base handler with error management
│   └── Container.ts            # IoC container
├── database/
│   ├── databaseManager.ts      # Connection manager
│   ├── interfaces/
│   │   └── DatabaseProvider.ts # Provider interface
│   ├── providers/
│   │   ├── SQLiteProvider.ts   # SQLite provider
│   │   └── MySQLProvider.ts    # MySQL provider
│   └── repositories/
│       ├── CrudRepository.ts   # Generic CRUD repository
│       └── GenericRepositoryFactory.ts # Repository factory
├── auth/
│   └── jwtManager.ts           # JWT management
├── middleware/
│   └── errorMiddleware.ts      # Error middleware
├── utils/
│   ├── errorHandler.ts         # Error handler
│   └── logger.ts               # Logging system
└── types/
    └── index.ts                # Wrapper types
```

## 🔧 Installation and Configuration

### 1. Installation
```bash
npm install
# Or copy the src/ folder to your project
```

### 2. Basic Configuration
```typescript
// Your configuration file
import { DatabaseManager } from './src/database/databaseManager';
import { uWebSocketWrapper } from './src/core/uWebSocketWrapper';

// Database configuration
const dbConfig = {
  useMySQL: false, // true for MySQL, false for SQLite
  dbFile: './app.sqlite', // For SQLite
  // For MySQL:
  // host: 'localhost',
  // port: 3306,
  // user: 'root',
  // password: '',
  // database: 'myapp'
};

// Initialization
const dbManager = new DatabaseManager(dbConfig);
const app = uWebSocketWrapper({
  port: 3000,
  databaseManager: dbManager
});
```

## 🛠️ Using Components

### 1. uWebSockets.js Wrapper

```typescript
import { uWebSocketWrapper, HttpHandler, WebSocketHandler } from './src/core/uWebSocketWrapper';

// Simple HTTP handler
const healthHandler: HttpHandler = async (res, req) => {
  return { status: 'healthy', timestamp: new Date().toISOString() };
};

// WebSocket handler
const wsHandler: WebSocketHandler = {
  message: (ws, message, opCode) => {
    ws.send('Echo: ' + message);
  },
  open: (ws) => {
    console.log('WebSocket connection opened');
  }
};

// Server configuration
const app = uWebSocketWrapper({
  port: 3000,
  routes: [
    { method: 'get', path: '/health', handler: healthHandler },
    { method: 'ws', path: '/chat', handler: wsHandler }
  ]
});
```

### 2. Database and Repositories

```typescript
import { DatabaseManager } from './src/database/databaseManager';
import { CrudRepository } from './src/database/repositories/CrudRepository';

// Define your model
interface User {
  id?: number;
  email: string;
  name: string;
  role: string;
  createdAt?: Date;
}

// Create specialized repository
class UserRepository extends CrudRepository<User> {
  constructor(provider: DatabaseProvider) {
    super(provider, {
      tableName: 'users',
      primaryKey: 'id'
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.findOneBy('email', email);
  }

  async findByRole(role: string): Promise<User[]> {
    return this.findBy('role', role);
  }
}

// Usage
const dbManager = new DatabaseManager(config);
await dbManager.initialize();

const userRepo = new UserRepository(dbManager.getProvider());

// CRUD operations
const user = await userRepo.create({
  email: 'user@example.com',
  name: 'John Doe',
  role: 'user'
});

const users = await userRepo.findAll();
const adminUsers = await userRepo.findByRole('admin');
```

### 3. Error Handling

```typescript
import { BaseHandler } from './src/core/BaseHandler';
import { AppError, ErrorCode } from './src/utils/errorHandler';

// Inherit from BaseHandler for automatic error handling
class MyHandler extends BaseHandler {
  async handleRequest(res: any, req: any) {
    try {
      // Your business logic
      if (!req.getQuery('id')) {
        throw new AppError(
          'Missing ID',
          ErrorCode.VALIDATION_ERROR,
          { field: 'id' }
        );
      }
      
      return { success: true };
    } catch (error) {
      // BaseHandler automatically handles errors
      this.handleError(error, res);
    }
  }
}
```

### 4. JWT Authentication

```typescript
import { JWTManager } from './src/auth/jwtManager';

const jwtManager = new JWTManager('your-secret-key');

// Token generation
const token = jwtManager.generateToken({ 
  userId: 123, 
  role: 'admin' 
});

// Token validation
const payload = jwtManager.verifyToken(token);

// Authentication middleware
const authMiddleware = (requireAuth: boolean) => {
  return async (res: any, req: any, next: Function) => {
    if (requireAuth) {
      const token = req.getHeader('authorization')?.replace('Bearer ', '');
      if (!token || !jwtManager.verifyToken(token)) {
        throw new AppError('Unauthorized', ErrorCode.AUTHENTICATION_ERROR);
      }
    }
    next();
  };
};
```

### 5. Repository Factory

```typescript
import { GenericRepositoryFactory } from './src/database/repositories/GenericRepositoryFactory';

// Define your repository types
interface AppRepositories {
  users: UserRepository;
  posts: PostRepository;
}

// Create factory
const factory = new GenericRepositoryFactory<AppRepositories>(
  dbManager.getProvider(),
  {
    users: (provider) => new UserRepository(provider),
    posts: (provider) => new PostRepository(provider)
  }
);

// Usage
const userRepo = factory.getRepository('users');
const postRepo = factory.getRepository('posts');
```

## 📝 Best Practices

### 1. Recommended Application Structure
```
your-app/
├── src/                    # Copy of uW-Wrap wrapper
├── app/
│   ├── models/
│   │   ├── User.ts
│   │   └── Post.ts
│   ├── repositories/
│   │   ├── UserRepository.ts
│   │   └── PostRepository.ts
│   ├── services/
│   │   ├── UserService.ts
│   │   └── PostService.ts
│   └── handlers/
│       ├── UserHandler.ts
│       └── PostHandler.ts
├── config/
│   └── database.ts
└── server.ts
```

### 2. Naming Conventions
- **Models**: PascalCase (User, Post)
- **Repositories**: ModelNameRepository
- **Services**: ModelNameService  
- **Handlers**: ModelNameHandler

### 3. Error Handling
- Use `AppError` for business errors
- Inherit from `BaseHandler` for automatic handling
- Log errors with appropriate level (ERROR, WARN, INFO)

### 4. Performance
- Use transactions for multiple operations
- Implement pagination for large lists
- Close WebSocket connections properly

## 🔍 Integration Examples

See the `example/` folder for a complete example of using the wrapper in a real application.

### Wrapper Structure (`src/`)

The `src/` folder contains the complete wrapper that can be integrated into any project:

```
src/
├── core/
│   ├── uWebSocketWrapper.ts        # Main wrapper
│   ├── BaseHandler.ts              # Base handler with error management
│   └── Container.ts                # IoC container
├── database/
│   ├── databaseManager.ts          # Database manager
│   ├── interfaces/
│   │   └── DatabaseProvider.ts     # Provider interface
│   ├── providers/
│   │   ├── SQLiteProvider.ts       # SQLite provider
│   │   └── MySQLProvider.ts        # MySQL provider
│   └── repositories/
│       ├── CrudRepository.ts       # Generic CRUD repository
│       └── GenericRepositoryFactory.ts # Repository factory
├── auth/
│   └── jwtManager.ts               # JWT authentication
├── middleware/
│   └── errorMiddleware.ts          # Error middleware
└── utils/
    ├── logger.ts                   # Logger
    └── errorHandler.ts             # Error handling
```

### `example/` - Example Application

The `example/` folder shows how to use the wrapper in a real application:

```
example/
├── server.ts                       # Main server using the wrapper
├── services/
│   └── UserService.ts              # Business service
└── models/
    └── User.ts                     # Data models
```

## How to Use the Wrapper

### 1. Installation in a New Project

```bash
# Copy wrapper files
cp -r src/ your-project/
cd your-project
npm install uwebsockets.js mysql2 sqlite3 jsonwebtoken
```

### 2. Basic Usage (New Simplified Approach)

```typescript
import { UWebSocketWrapper } from './src/core/uWebSocketWrapper';
import { DatabaseManager } from './src/database/databaseManager';
import { SQLiteProvider } from './src/database/providers/SQLiteProvider';
import { Logger } from './src/utils/logger';
import { ErrorHandler } from './src/utils/errorHandler';

// Initialization
const logger = new Logger();
const errorHandler = new ErrorHandler(logger);

// Database configuration
const provider = new SQLiteProvider('./database.sqlite', logger, errorHandler);
const dbManager = new DatabaseManager(provider, logger, errorHandler);

// Server
const server = new UWebSocketWrapper(3000, logger, errorHandler);

// Startup
async function start() {
    await dbManager.initialize();
    await dbManager.initializeSchema('./schema.sql');
    
    // Repositories are automatically available!
    const users = dbManager.repositories.users;
    
    // Routes
    server.addHttpHandler('get', '/users', async (req, res) => {
        const allUsers = await users.findAll();
        server.sendJSON(res, { users: allUsers });
    });
    
    server.addHttpHandler('post', '/users', async (req, res) => {
        const body = await server.readBody(res);
        const userData = JSON.parse(body);
        
        // Automatic validation included!
        const user = await users.createUser(userData);
        server.sendJSON(res, { user });
    });
    
    await server.start();
}
```

## New Automatic Features

### 1. Auto-Configured Repositories

No need to manually create repositories! The `RepositoryManager` generates them automatically:

```typescript
// ✅ NEW - Automatic
const dbManager = new DatabaseManager(provider, logger, errorHandler);
const users = dbManager.repositories.users; // Auto-created with validation!

// ❌ OLD - Manual
const userRepo = new UserRepository(provider);
```

### 2. Automatic Validation Methods

Repositories automatically include validation methods:

```typescript
// Automatic uniqueness checks
const emailTaken = await users.emailExists('test@example.com');
const usernameTaken = await users.usernameExists('johndoe');

// Auto-generated specialized searches
const user = await users.findByEmail('test@example.com');
const adminUsers = await users.findByRole('admin');
```

### 3. Centralized Configuration

Repositories are automatically configured via `REPOSITORY_CONFIGS`:

```typescript
// In RepositoryManager.ts
const REPOSITORY_CONFIGS = {
    users: {
        tableName: 'users',
        primaryKey: 'id',
        uniqueFields: ['email', 'username'] // Auto-generates emailExists(), usernameExists()
    },
    posts: {
        tableName: 'posts',
        primaryKey: 'id'
    }
} as const;
```

## Available Methods

### Base Repository (CrudRepository)

```typescript
// Basic CRUD
await repo.create(data);
await repo.findById(id);
await repo.findAll();
await repo.updateById(id, data);
await repo.deleteById(id);

// Advanced searches
await repo.findBy('field', value);
await repo.findAllPaginated(options);
await repo.count();
await repo.exists(id);
```

### Users Repository (Auto-generated)

```typescript
// Specialized user methods
await users.createUser(userData);      // With validation
await users.updateUser(id, data);      // With timestamps
await users.emailExists(email);        // Uniqueness validation
await users.usernameExists(username);  // Uniqueness validation
await users.findByEmail(email);        // Search by email
await users.findByRole(role);          // Search by role
```

## Transactions

```typescript
const result = await dbManager.repositories.transaction(async (repos) => {
    const user = await repos.users.createUser(userData);
    const profile = await repos.profiles.create({ userId: user.id, ...profileData });
    return { user, profile };
});
```

## Migration from Old Approach

### Before (Manual)
```typescript
// Manual repository creation
const userRepo = new UserRepository(provider);
const user = await userRepo.createUser(userData);
```

### After (Automatic)
```typescript
// Auto-generation
const users = dbManager.repositories.users;
const user = await users.createUser(userData); // Same method!
```

## Advantages of the New Approach

1. **Zero Boilerplate** - No need to manually create repository classes
2. **Automatic Validation** - Validation methods generated automatically
3. **Type Safety** - Complete TypeScript support
4. **Centralized Configuration** - Single configuration for all repositories
5. **Extensibility** - Easy to add new repositories
6. **Consistent API** - Same interface for all repositories

## Complete Example

See the `example/server.ts` file for a complete example of using the new simplified approach.

## Support

- MySQL and SQLite supported
- JWT Authentication included
- WebSocket support
- Integrated logging and error handling
- Automatic pagination
- Transaction support

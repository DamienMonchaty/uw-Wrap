# Repository Pattern - Usage Guide

Documentation of the generic repository system provided by uW-Wrap.

## 🎯 Overview

The uW-Wrap wrapper provides a powerful and type-safe repository system for database operations:

- **CrudRepository<TModel>** - Generic repository with CRUD operations
- **GenericRepositoryFactory** - Factory to create and manage repositories
- **DatabaseProvider** - Interface for SQLite/MySQL
- **Transaction support** - Atomic operations

## 🏗️ Architecture

```
src/database/
├── databaseManager.ts              # Main manager
├── interfaces/
│   └── DatabaseProvider.ts         # Provider interface
├── providers/
│   ├── SQLiteProvider.ts           # SQLite provider
│   └── MySQLProvider.ts            # MySQL provider
└── repositories/
    ├── CrudRepository.ts           # Base CRUD repository
    └── GenericRepositoryFactory.ts # Generic factory
```

## 🔧 Basic Usage

### 1. Define a Model

```typescript
// Your data model
interface User {
  id?: number;
  email: string;
  name: string;
  role: string;
  createdAt?: Date;
  updatedAt?: Date;
}
```

### 2. Create a Custom Repository

```typescript
import { CrudRepository } from './src/database/repositories/CrudRepository';
import { DatabaseProvider } from './src/database/interfaces/DatabaseProvider';

class UserRepository extends CrudRepository<User> {
  constructor(provider: DatabaseProvider) {
    super(provider, {
      tableName: 'users',
      primaryKey: 'id',
      timestamps: true,    // Manages created_at/updated_at
      softDeletes: false   // Uses deleted_at for soft deletion
    });
  }

  // Custom methods specific to users
  async findByEmail(email: string): Promise<User | null> {
    return this.findOneBy('email', email);
  }

  async findByRole(role: string): Promise<User[]> {
    return this.findBy('role', role);
  }

  async updateRole(userId: number, newRole: string): Promise<User | null> {
    return this.updateById(userId, { role: newRole });
  }
}
```

### 3. Use the Repository

```typescript
import { DatabaseManager } from './src/database/databaseManager';

// Initialize database
const dbManager = new DatabaseManager({
  useMySQL: false,
  dbFile: './app.sqlite'
});

await dbManager.initialize();

// Create repository
const userRepo = new UserRepository(dbManager.getProvider());

// CRUD operations
const newUser = await userRepo.create({
  email: 'john@example.com',
  name: 'John Doe',
  role: 'user'
});

const users = await userRepo.findAll();
const adminUsers = await userRepo.findByRole('admin');
const user = await userRepo.findByEmail('john@example.com');
```

## 🏭 Repository Factory

For applications with multiple repositories, use the factory:

```typescript
import { GenericRepositoryFactory } from './src/database/repositories/GenericRepositoryFactory';

// Define your repository types
interface AppRepositories {
  users: UserRepository;
  posts: PostRepository;
  comments: CommentRepository;
}

// Create factory
const factory = new GenericRepositoryFactory<AppRepositories>(
  dbManager.getProvider(),
  {
    users: (provider) => new UserRepository(provider),
    posts: (provider) => new PostRepository(provider),
    comments: (provider) => new CommentRepository(provider)
  }
);

// Use repositories
const userRepo = factory.getRepository('users');
const postRepo = factory.getRepository('posts');

// All repositories share the same database connection
const user = await userRepo.findById(1);
const userPosts = await postRepo.findBy('user_id', user.id);
```

## 📋 Available Methods

### Base CRUD Operations

```typescript
// Create
const user = await repo.create({
  email: 'test@example.com',
  name: 'Test User',
  role: 'user'
});

// Read
const user = await repo.findById(1);
const users = await repo.findAll();
const adminUsers = await repo.findBy('role', 'admin');
const user = await repo.findOneBy('email', 'test@example.com');

// Update
const updatedUser = await repo.updateById(1, { name: 'New Name' });
const updatedUsers = await repo.updateBy('role', 'user', { role: 'member' });

// Delete
const success = await repo.deleteById(1);
const deletedCount = await repo.deleteBy('role', 'inactive');

// Utility
const count = await repo.count();
const exists = await repo.exists(1);
const roleCount = await repo.countBy('role', 'admin');
```

### Pagination

```typescript
// Simple pagination
const page1 = await repo.findAllPaginated({ page: 1, limit: 10 });
const page2 = await repo.findAllPaginated({ page: 2, limit: 10 });

// Pagination with conditions
const adminPage = await repo.findByPaginated('role', 'admin', { page: 1, limit: 5 });

// Response structure
interface PaginatedResult<T> {
  data: T[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}
```

### Advanced Queries

```typescript
// Custom WHERE conditions
const users = await repo.findWhere(
  'role = ? AND created_at > ?',
  ['admin', '2023-01-01']
);

// Raw SQL query
const result = await repo.query(
  'SELECT role, COUNT(*) as count FROM users GROUP BY role'
);

// Custom SELECT with joins
const usersWithPosts = await repo.query(`
  SELECT u.*, COUNT(p.id) as post_count
  FROM users u
  LEFT JOIN posts p ON u.id = p.user_id
  GROUP BY u.id
`);
```

## 💾 Transaction Management

```typescript
// Simple transaction
await repo.transaction(async (repo) => {
  const user = await repo.create({ email: 'test@example.com', name: 'Test' });
  await repo.updateById(user.id, { role: 'verified' });
  return user;
});

// Multi-repository transaction
await factory.transaction(async (repos) => {
  const user = await repos.users.create(userData);
  const post = await repos.posts.create({ ...postData, user_id: user.id });
  const comment = await repos.comments.create({ ...commentData, post_id: post.id });
  
  return { user, post, comment };
});
```

## ⚙️ Repository Configuration

```typescript
interface RepositoryConfig {
  tableName: string;           // Database table name
  primaryKey: string;          // Primary key field (default: 'id')
  timestamps?: boolean;        // Manage created_at/updated_at (default: false)
  softDeletes?: boolean;       // Use deleted_at for deletion (default: false)
  timestampFields?: {          // Custom timestamp field names
    createdAt: string;
    updatedAt: string;
    deletedAt?: string;
  };
}

// Example with custom configuration
class PostRepository extends CrudRepository<Post> {
  constructor(provider: DatabaseProvider) {
    super(provider, {
      tableName: 'blog_posts',
      primaryKey: 'post_id',
      timestamps: true,
      softDeletes: true,
      timestampFields: {
        createdAt: 'date_created',
        updatedAt: 'date_modified',
        deletedAt: 'date_deleted'
      }
    });
  }
}
```

## 🎭 Advanced Patterns

### 1. Repository with Validation

```typescript
class ValidatedUserRepository extends UserRepository {
  async create(data: Partial<User>): Promise<User> {
    // Validation before creation
    if (!data.email || !data.email.includes('@')) {
      throw new Error('Valid email is required');
    }
    
    if (!data.name || data.name.length < 2) {
      throw new Error('Name must be at least 2 characters');
    }
    
    // Check email uniqueness
    const existingUser = await this.findByEmail(data.email);
    if (existingUser) {
      throw new Error('Email already exists');
    }
    
    return super.create(data);
  }
}
```

### 2. Repository with Caching

```typescript
class CachedUserRepository extends UserRepository {
  private cache = new Map<number, User>();
  
  async findById(id: number): Promise<User | null> {
    // Check cache first
    if (this.cache.has(id)) {
      return this.cache.get(id)!;
    }
    
    // Fetch from database
    const user = await super.findById(id);
    if (user) {
      this.cache.set(id, user);
    }
    
    return user;
  }
  
  async updateById(id: number, data: Partial<User>): Promise<User | null> {
    const result = await super.updateById(id, data);
    
    // Invalidate cache
    this.cache.delete(id);
    
    return result;
  }
}
```

### 3. Repository with Events

```typescript
import { EventEmitter } from 'events';

class EventEmittingUserRepository extends UserRepository {
  private events = new EventEmitter();
  
  async create(data: Partial<User>): Promise<User> {
    const user = await super.create(data);
    this.events.emit('user:created', user);
    return user;
  }
  
  async updateById(id: number, data: Partial<User>): Promise<User | null> {
    const user = await super.updateById(id, data);
    if (user) {
      this.events.emit('user:updated', user);
    }
    return user;
  }
  
  on(event: string, listener: Function) {
    this.events.on(event, listener);
  }
}

// Usage
const userRepo = new EventEmittingUserRepository(provider);
userRepo.on('user:created', (user) => {
  console.log('New user created:', user.email);
});
```

## 🔧 Database Provider Interface

If you need to implement a custom database provider:

```typescript
interface DatabaseProvider {
  // Connection management
  initialize(): Promise<void>;
  close(): Promise<void>;
  isConnected(): boolean;
  
  // Query execution
  query(sql: string, params?: any[]): Promise<any>;
  run(sql: string, params?: any[]): Promise<{ lastID?: number; changes?: number }>;
  
  // Transaction support
  beginTransaction(): Promise<void>;
  commitTransaction(): Promise<void>;
  rollbackTransaction(): Promise<void>;
  
  // Utility
  escape(value: any): string;
  getLastInsertId(): Promise<number>;
}
```

## 📊 Performance Tips

### 1. Use Indexes

```sql
-- Create indexes for frequently queried fields
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_created_at ON users(created_at);
```

### 2. Batch Operations

```typescript
// Instead of multiple individual creates
for (const userData of usersData) {
  await userRepo.create(userData); // Slow
}

// Use batch insert when available
await userRepo.batchCreate(usersData); // Fast
```

### 3. Select Only Needed Fields

```typescript
// Custom query for specific fields only
const userEmails = await userRepo.query(
  'SELECT email FROM users WHERE role = ?',
  ['admin']
);
```

## 🧪 Testing Repositories

```typescript
import { SQLiteProvider } from './src/database/providers/SQLiteProvider';

describe('UserRepository', () => {
  let provider: SQLiteProvider;
  let userRepo: UserRepository;
  
  beforeEach(async () => {
    // Use in-memory database for tests
    provider = new SQLiteProvider(':memory:');
    await provider.initialize();
    
    // Create test schema
    await provider.run(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    userRepo = new UserRepository(provider);
  });
  
  afterEach(async () => {
    await provider.close();
  });
  
  test('should create user', async () => {
    const user = await userRepo.create({
      email: 'test@example.com',
      name: 'Test User',
      role: 'user'
    });
    
    expect(user.id).toBeDefined();
    expect(user.email).toBe('test@example.com');
  });
  
  test('should find user by email', async () => {
    await userRepo.create({
      email: 'test@example.com',
      name: 'Test User',
      role: 'user'
    });
    
    const user = await userRepo.findByEmail('test@example.com');
    expect(user).toBeTruthy();
    expect(user!.name).toBe('Test User');
  });
});
```

## 🔗 Integration with uW-Wrap

The repository system integrates seamlessly with the uW-Wrap server:

```typescript
import { uWebSocketWrapper } from './src/core/uWebSocketWrapper';
import { DatabaseManager } from './src/database/databaseManager';

// Initialize
const dbManager = new DatabaseManager(config);
const userRepo = new UserRepository(dbManager.getProvider());

// Use in HTTP handlers
const app = uWebSocketWrapper({
  port: 3000,
  routes: [
    {
      method: 'get',
      path: '/users',
      handler: async (res, req) => {
        const users = await userRepo.findAll();
        return { users };
      }
    },
    {
      method: 'post',
      path: '/users',
      handler: async (res, req) => {
        const body = await req.readBody();
        const userData = JSON.parse(body);
        const user = await userRepo.create(userData);
        return { user };
      }
    }
  ]
});
```

## 📚 Complete Example

See the `example/` folder for a complete implementation using repositories with the uW-Wrap server, including:

- User repository with custom methods
- Service layer using repositories
- HTTP handlers for CRUD operations
- Error handling and validation
- Transaction examples

The repository pattern provides a clean, type-safe, and maintainable way to handle database operations in your uW-Wrap applications.

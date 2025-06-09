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

class UserRepository extends CrudRepository<User> {
  constructor(provider: DatabaseProvider) {
    super(provider, {
      tableName: 'users',
      primaryKey: 'id'
    });
  }

  // Méthodes spécialisées
  async findByEmail(email: string): Promise<User | null> {
    return this.findOneBy('email', email);
  }

  async findByRole(role: string): Promise<User[]> {
    return this.findBy('role', role);
  }

  async findActiveUsers(): Promise<User[]> {
    return this.findByCriteria({
      role: ['user', 'admin'], // IN clause
      createdAt: { '>': new Date('2023-01-01') } // Date comparison
    });
  }
}
```

### 3. Utiliser la factory de repositories

```typescript
import { GenericRepositoryFactory } from './src/database/repositories/GenericRepositoryFactory';

// Définir vos types de repositories
interface AppRepositories {
  users: UserRepository;
  posts: PostRepository;
  categories: CategoryRepository;
}

// Créer la factory
const factory = new GenericRepositoryFactory<AppRepositories>(
  dbManager.getProvider(),
  {
    users: (provider) => new UserRepository(provider),
    posts: (provider) => new PostRepository(provider),
    categories: (provider) => new CategoryRepository(provider)
  }
);

// Utilisation
const userRepo = factory.getRepository('users');
const postRepo = factory.getRepository('posts');
```

## 📚 API du CrudRepository

### Opérations de lecture

```typescript
// Tous les enregistrements
const users = await userRepo.findAll();

// Par ID
const user = await userRepo.findById(123);

// Par critère simple
const adminUsers = await userRepo.findBy('role', 'admin');
const user = await userRepo.findOneBy('email', 'user@example.com');

// Par critères multiples
const users = await userRepo.findByCriteria({
  role: 'admin',
  createdAt: { '>': new Date('2023-01-01') }
});

// Avec pagination
const result = await userRepo.findWithPagination({
  page: 1,
  limit: 10,
  criteria: { role: 'user' }
});

// Vérifier l'existence
const exists = await userRepo.existsBy('email', 'user@example.com');

// Compter
const count = await userRepo.count();
const adminCount = await userRepo.countBy('role', 'admin');
```

### Opérations d'écriture

```typescript
// Créer
const newUser = await userRepo.create({
  email: 'user@example.com',
  name: 'John Doe',
  role: 'user'
});

// Créer multiple
const users = await userRepo.createMany([
  { email: 'user1@example.com', name: 'User 1', role: 'user' },
  { email: 'user2@example.com', name: 'User 2', role: 'admin' }
]);

// Mettre à jour
const updatedUser = await userRepo.update(123, {
  name: 'Jane Doe',
  role: 'admin'
});

// Mettre à jour par critères
await userRepo.updateByCriteria(
  { role: 'user' },  // critères
  { role: 'member' } // nouvelles valeurs
);

// Supprimer
await userRepo.delete(123);

// Supprimer par critères
await userRepo.deleteByCriteria({ role: 'inactive' });
```

## 🔄 Gestion des transactions

```typescript
// Transaction simple
await userRepo.transaction(async (trx) => {
  const user = await userRepo.create({
    email: 'user@example.com',
    name: 'John Doe',
    role: 'user'
  }, trx);

  await postRepo.create({
    userId: user.id,
    title: 'Premier post',
    content: 'Contenu du post'
  }, trx);

  // Si une erreur est lancée, la transaction est annulée automatiquement
});

// Transaction avec le provider directement
await dbManager.getProvider().transaction(async (trx) => {
  // Opérations multiples avec le même contexte transactionnel
  await userRepo.create(userData, trx);
  await profileRepo.create(profileData, trx);
  await settingsRepo.create(settingsData, trx);
});
```

## 🛠️ Configuration avancée

### Personnaliser la configuration du repository

```typescript
class UserRepository extends CrudRepository<User> {
  constructor(provider: DatabaseProvider) {
    super(provider, {
      tableName: 'users',
      primaryKey: 'id',
      timestamps: true,          // Gère automatiquement createdAt/updatedAt
      softDeletes: true,         // Suppression logique avec deletedAt
      dateFields: ['createdAt', 'updatedAt', 'lastLogin'],
      jsonFields: ['metadata', 'preferences']
    });
  }
}
```

### Validation personnalisée

```typescript
class UserRepository extends CrudRepository<User> {
  async create(data: Partial<User>, transaction?: any): Promise<User> {
    // Validation avant création
    if (await this.existsBy('email', data.email!)) {
      throw new AppError('Email déjà utilisé', ErrorCode.CONFLICT);
    }

    if (!data.email?.includes('@')) {
      throw new AppError('Email invalide', ErrorCode.VALIDATION_ERROR);
    }

    return super.create(data, transaction);
  }

  async update(id: number, data: Partial<User>, transaction?: any): Promise<User> {
    // Validation avant mise à jour
    if (data.email) {
      const existing = await this.findOneBy('email', data.email);
      if (existing && existing.id !== id) {
        throw new AppError('Email déjà utilisé', ErrorCode.CONFLICT);
      }
    }

    return super.update(id, data, transaction);
  }
}
```

## 📊 Critères de recherche avancés

```typescript
// Opérateurs supportés
const users = await userRepo.findByCriteria({
  age: { '>=': 18, '<': 65 },           // Between
  role: ['user', 'admin'],              // IN
  email: { 'LIKE': '%@company.com' },   // LIKE
  createdAt: { '>': new Date('2023-01-01') },
  deletedAt: null                       // IS NULL
});

// Tri et limitation
const users = await userRepo.findByCriteria(
  { role: 'user' },
  {
    orderBy: { createdAt: 'DESC', name: 'ASC' },
    limit: 50,
    offset: 100
  }
);
```

## 🚀 Bonnes pratiques

### 1. Nommage des repositories
```typescript
// ✅ Bon
class UserRepository extends CrudRepository<User> {}
class PostRepository extends CrudRepository<Post> {}

// ❌ Éviter
class Users extends CrudRepository<User> {}
class PostRepo extends CrudRepository<Post> {}
```

### 2. Méthodes spécialisées
```typescript
class UserRepository extends CrudRepository<User> {
  // ✅ Méthodes métier claires
  async findActiveAdmins(): Promise<User[]> {
    return this.findByCriteria({
      role: 'admin',
      status: 'active'
    });
  }

  async deactivateUser(id: number): Promise<void> {
    await this.update(id, { status: 'inactive' });
  }
}
```

### 3. Gestion des erreurs
```typescript
class UserRepository extends CrudRepository<User> {
  async findByEmailOrThrow(email: string): Promise<User> {
    const user = await this.findOneBy('email', email);
    if (!user) {
      throw new AppError('Utilisateur non trouvé', ErrorCode.NOT_FOUND);
    }
    return user;
  }
}
```

## 🔍 Exemple complet

Voir le dossier `example/` pour un exemple d'implémentation complète avec UserRepository.

// Create a user
const user = await repos.users.createUser({
    username: "john_doe",
    email: "john@example.com",
    name: "John Doe"
});

// Find users
const allUsers = await repos.users.findAll();
const userById = await repos.users.findById(1);
const userByEmail = await repos.users.findByEmail("john@example.com");

// Update user
const updatedUser = await repos.users.updateUser(1, {
    name: "John Smith"
});

// Delete user
const deleted = await repos.users.deleteById(1);
```

### Advanced Operations

```typescript
// Transaction example
const result = await dbManager.repositories.transaction(async (repos) => {
    const user1 = await repos.users.createUser({...});
    const user2 = await repos.users.createUser({...});
    return [user1, user2];
});

// Specialized queries
const adminUsers = await repos.users.findByRole("admin");
const emailExists = await repos.users.emailExists("test@example.com");
```

### API Endpoints

The server provides RESTful endpoints that demonstrate repository usage:

#### User Management
- `GET /users` - List all users
- `GET /users/:id` - Get user by ID
- `POST /users` - Create new user
- `PUT /users/:id` - Update user
- `DELETE /users/:id` - Delete user
- `GET /users/by-role/:role` - Get users by role
- `POST /users/batch` - Create multiple users in transaction

#### Authentication
- `POST /auth/login` - User login
- `GET /protected` - Protected route (requires JWT)

#### Health Check
- `GET /health` - Server health status

## Database Configuration

### SQLite (Default)
```env
USE_MYSQL=false
DB_FILE=./database.sqlite
```

### MySQL
```env
USE_MYSQL=true
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=uwrap_db
```

## Creating Custom Repositories

### 1. Define Model Interface

```typescript
// src/database/models/Product.ts
export interface Product {
    id?: number;
    name: string;
    price: number;
    category_id: number;
    created_at?: string;
    updated_at?: string;
}
```

### 2. Create Repository

```typescript
// src/database/repositories/ProductRepository.ts
import { CrudRepository } from './CrudRepository';
import { Product } from '../models/Product';
import { DatabaseProvider } from '../interfaces/DatabaseProvider';

export class ProductRepository extends CrudRepository<Product> {
    constructor(provider: DatabaseProvider) {
        super(provider, {
            tableName: 'products',
            primaryKey: 'id'
        });
    }

    async findByCategory(categoryId: number): Promise<Product[]> {
        return this.findBy('category_id', categoryId);
    }

    async findExpensiveProducts(minPrice: number): Promise<Product[]> {
        // You can use the underlying provider for complex queries
        const sql = 'SELECT * FROM products WHERE price >= ?';
        const results = await this.getProvider().query(sql, [minPrice]);
        return results as Product[];
    }
}
```

### 3. Add to Repository Manager

```typescript
// Add to RepositoryManager.ts
private _productRepository: ProductRepository | null = null;

get products(): ProductRepository {
    if (!this._productRepository) {
        this._productRepository = new ProductRepository(this.provider);
        this.logger.debug('ProductRepository initialized');
    }
    return this._productRepository;
}
```

## Error Handling

The repository system includes comprehensive error handling:

- **Validation Errors**: Thrown for business rule violations
- **Database Errors**: Wrapped with context information
- **Transaction Errors**: Automatic rollback on failure

## Performance Considerations

- **Connection Pooling**: MySQL provider uses connection pooling
- **Lazy Loading**: Repositories initialized only when needed
- **Transactions**: Use for multi-operation consistency
- **Indexing**: Ensure proper database indexes for frequently queried fields

## Testing

Test your repositories with:

```bash
# Start server
npm start

# Test endpoints
curl -X GET http://localhost:3001/users
curl -X POST http://localhost:3001/users -H "Content-Type: application/json" -d '{"username":"test","email":"test@example.com"}'
```

## Future Enhancements

- **Pagination**: Add pagination support to CrudRepository
- **Query Builder**: Implement fluent query builder
- **Caching**: Add Redis caching layer
- **Migrations**: Database migration system
- **Soft Deletes**: Support for soft delete operations

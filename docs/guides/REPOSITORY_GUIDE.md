# Repository Pattern - Usage Guide

Documentation of the generic repository system provided by uW-Wrap.

## 🎯 Overview

The uW-Wrap framework provides a powerful and type-safe repository system for database operations:

- **CrudRepository<TModel>** - Generic repository with CRUD operations
- **GenericRepositoryFactory** - Factory to create and manage repositories
- **DatabaseProvider** - Interface for SQLite/MySQL
- **Transaction support** - Atomic operations

## 🏗️ Architecture

```
src/database/
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
      timestamps: true,
      softDeletes: false
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.findOneBy('email', email);
  }

  async findByRole(role: string): Promise<User[]> {
    return this.findBy('role', role);
  }
}
```

### 3. Use the Repository

```typescript
// Initialize database
const config = {
  database: {
    type: 'sqlite' as const,
    sqlite: { file: './app.db' }
  }
};

const app = new ApplicationBootstrap(config);
await app.start();

// Use repository through the application
const userRepo = new UserRepository(provider);
const users = await userRepo.findAll();
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

// Update
const updatedUser = await repo.updateById(1, { name: 'New Name' });

// Delete
const success = await repo.deleteById(1);

// Utility
const count = await repo.count();
const exists = await repo.exists(1);
```

## 💾 Transaction Management

```typescript
// Simple transaction
await repo.transaction(async (repo) => {
  const user = await repo.create({ email: 'test@example.com', name: 'Test' });
  await repo.updateById(user.id, { role: 'verified' });
  return user;
});
```

## ⚙️ Repository Configuration

```typescript
interface RepositoryConfig {
  tableName: string;
  primaryKey: string;
  timestamps?: boolean;
  softDeletes?: boolean;
}

class PostRepository extends CrudRepository<Post> {
  constructor(provider: DatabaseProvider) {
    super(provider, {
      tableName: 'blog_posts',
      primaryKey: 'post_id',
      timestamps: true,
      softDeletes: true
    });
  }
}
```

---

**Repository pattern provides a clean, type-safe, and maintainable way to handle database operations in your uW-Wrap applications.** 🚀

# SQLite Configuration - uW-Wrap

Complete SQLite configuration guide for uW-Wrap framework development and lightweight production.

## 🎯 Quick Setup

### 1. Environment Variables

Create a `.env` file in your project root:

```bash
# .env
NODE_ENV=development
PORT=3000
JWT_SECRET=your-development-jwt-key
JWT_EXPIRES_IN=24h

# SQLite Configuration
DB_FILE=./database/app.db
# or use in-memory database for testing
# DB_FILE=:memory:
```

### 2. Application Configuration

```typescript
import { ApplicationBootstrap } from 'uw-wrap';

const config = {
    port: Number(process.env.PORT) || 3000,
    jwtSecret: process.env.JWT_SECRET!,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
    enableLogging: true,
    logLevel: 'debug', // More verbose for development
    database: {
        type: 'sqlite' as const,
        sqlite: {
            file: process.env.DB_FILE || './app.db'
        }
    }
};

const app = new ApplicationBootstrap(config);
await app.start();
```

## 🗄️ Database Setup

### 1. Automatic Database Creation

SQLite databases are created automatically when they don't exist. uW-Wrap will:

1. Create the database file if it doesn't exist
2. Initialize tables through your repository definitions
3. Handle schema migrations automatically

### 2. Manual Database Creation (Optional)

If you prefer to create the database manually:

```bash
# Create database directory
mkdir -p database

# Create SQLite database
sqlite3 database/app.db

# In SQLite prompt:
.tables
.quit
```

### 3. Example Schema

While uW-Wrap handles table creation automatically, here's what your schema might look like:

```sql
-- Users table
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    password_hash TEXT,
    metadata TEXT, -- JSON stored as TEXT in SQLite
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_created_at ON users(created_at);

-- Products table
CREATE TABLE products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    category TEXT,
    stock_quantity INTEGER DEFAULT 0,
    metadata TEXT, -- JSON stored as TEXT
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL
);

-- Indexes
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_price ON products(price);
CREATE INDEX idx_products_created_at ON products(created_at);
```

## ⚙️ Configuration Options

### 1. File-Based Database (Recommended)

```typescript
const config = {
    port: Number(process.env.PORT) || 3000,
    jwtSecret: process.env.JWT_SECRET!,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
    enableLogging: true,
    logLevel: 'debug',
    database: {
        type: 'sqlite' as const,
        sqlite: {
            file: process.env.DB_FILE || './app.db'
        }
    }
};
```

### 2. In-Memory Database (Testing)

```typescript
const testConfig = {
    port: 3001,
    jwtSecret: 'test-secret',
    database: {
        type: 'sqlite' as const,
        sqlite: {
            file: ':memory:' // Temporary in-memory database
        }
    }
};
```

### 3. Production Configuration

```typescript
const prodConfig = {
    port: Number(process.env.PORT) || 3000,
    jwtSecret: process.env.JWT_SECRET!,
    enableLogging: true,
    logLevel: 'info',
    database: {
        type: 'sqlite' as const,
        sqlite: {
            file: process.env.DB_FILE || './data/production.db'
        }
    }
};
```

---

**SQLite provides an excellent foundation for uW-Wrap applications, offering simplicity and performance for most use cases!** 🚀

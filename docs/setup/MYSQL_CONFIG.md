# MySQL Configuration - uW-Wrap

MySQL configuration guide for the uWebSockets.js wrapper.

## 🎯 Quick Setup

### 1. Environment Variables

```bash
# .env
USE_MYSQL=true
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=myapp
```

### 2. Initialization in Your Application

```typescript
import { DatabaseManager } from './src/database/databaseManager';

const dbManager = new DatabaseManager({
  useMySQL: process.env.USE_MYSQL === 'true',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 10
});

await dbManager.initialize();
```

## 🛠️ MySQL Installation

### Windows
1. Download [MySQL Community Server](https://dev.mysql.com/downloads/mysql/)
2. Install with default settings
3. Note the root password

### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install mysql-server
sudo mysql_secure_installation
```

### macOS
```bash
brew install mysql
brew services start mysql
```

## 🗄️ Database Configuration

### 1. Create Database

```sql
-- Connect as root
mysql -u root -p

-- Create database
CREATE DATABASE myapp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create dedicated user (recommended)
CREATE USER 'myapp_user'@'localhost' IDENTIFIED BY 'secure_password';
GRANT ALL PRIVILEGES ON myapp.* TO 'myapp_user'@'localhost';
FLUSH PRIVILEGES;
```

### 2. Base Schema (Example)

```sql
USE myapp;

-- Users table
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    password_hash VARCHAR(255),
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL
);

-- Performance indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_created_at ON users(created_at);
```

## ⚙️ Advanced Configuration

### 1. Connection Pool

```typescript
const dbManager = new DatabaseManager({
  useMySQL: true,
  host: 'localhost',
  port: 3306,
  user: 'myapp_user',
  password: 'secure_password',
  database: 'myapp',
  
  // Pool configuration
  connectionLimit: 10,
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true,
  
  // SSL options (production)
  ssl: {
    ca: fs.readFileSync('./ssl/ca-cert.pem'),
    cert: fs.readFileSync('./ssl/client-cert.pem'),
    key: fs.readFileSync('./ssl/client-key.pem')
  }
});
```

### 2. Master-Slave Replication

```typescript
const dbManager = new DatabaseManager({
  useMySQL: true,
  
  // Master server (write)
  master: {
    host: 'master.mysql.example.com',
    user: 'app_user',
    password: 'password',
    database: 'myapp'
  },
  
  // Slave servers (read)
  slaves: [
    {
      host: 'slave1.mysql.example.com',
      user: 'app_user',
      password: 'password', 
      database: 'myapp'
    },
    {
      host: 'slave2.mysql.example.com',
      user: 'app_user',
      password: 'password',
      database: 'myapp'
    }
  ]
});
```

## 🔧 Usage with Repositories

```typescript
import { CrudRepository } from './src/database/repositories/CrudRepository';

class UserRepository extends CrudRepository<User> {
  constructor(provider: DatabaseProvider) {
    super(provider, {
      tableName: 'users',
      primaryKey: 'id',
      timestamps: true,    // uses created_at/updated_at
      softDeletes: true    // uses deleted_at
    });
  }
}

// Usage
const userRepo = new UserRepository(dbManager.getProvider());
const users = await userRepo.findAll();
```

## 🚀 MySQL Optimizations

### 1. my.cnf Configuration

```ini
[mysqld]
# Connection pool
max_connections = 200
thread_cache_size = 16

# Cache and buffers
innodb_buffer_pool_size = 1G
query_cache_size = 64M
query_cache_type = 1

# Logs
slow_query_log = 1
slow_query_log_file = /var/log/mysql/slow.log
long_query_time = 2

# Charset
character-set-server = utf8mb4
collation-server = utf8mb4_unicode_ci
```

### 2. Indexes and Queries

```sql
-- Analyze slow queries
EXPLAIN SELECT * FROM users WHERE email = 'user@example.com';

-- Create composite indexes
CREATE INDEX idx_users_role_created ON users(role, created_at);

-- Optimize JSON queries
CREATE INDEX idx_users_metadata_type ON users((metadata->>'$.type'));
```

## 🔍 Debugging and Monitoring

### 1. Debug Logs

```typescript
// Enable SQL logs
const dbManager = new DatabaseManager({
  useMySQL: true,
  // ... other options
  debug: process.env.NODE_ENV === 'development',
  logging: (sql, timing) => {
    console.log(`[${timing}ms] ${sql}`);
  }
});
```

### 2. Performance Monitoring

```typescript
// Connection metrics
const stats = dbManager.getConnectionStats();
console.log('Active connections:', stats.activeConnections);
console.log('Queued connections:', stats.queuedConnections);

// Health check
const isHealthy = await dbManager.healthCheck();
```

## ⚠️ Security

### 1. Best Practices

- Use dedicated users with minimal privileges
- Enable SSL in production
- Encrypt sensitive data
- Use prepared statements (automatic with uW-Wrap)
- Validate all user inputs

### 2. Secure Configuration Example

```typescript
const dbManager = new DatabaseManager({
  useMySQL: true,
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  
  // Security
  ssl: { rejectUnauthorized: true },
  multipleStatements: false,
  timeout: 10000,
  
  // Secure pool
  connectionLimit: 5,
  acquireTimeout: 10000
});
```

## 🔗 Resources

- [MySQL Documentation](https://dev.mysql.com/doc/)
- [mysql2 NPM Package](https://www.npmjs.com/package/mysql2)
- [MySQL Optimization](https://dev.mysql.com/doc/refman/8.0/en/optimization.html)

### 1. Create Database

Connect to MySQL as root:
```bash
mysql -u root -p
```

Create the database:
```sql
CREATE DATABASE uwrap_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Create a dedicated user (optional but recommended):
```sql
CREATE USER 'uwrap_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON uwrap_db.* TO 'uwrap_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 2. Environment Configuration

Copy the example configuration file:
```bash
cp .env.example .env
```

Edit the `.env` file:
```env
# Enable MySQL
USE_MYSQL=true

# MySQL configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=uwrap_user
DB_PASSWORD=your_password
DB_NAME=uwrap_db

# JWT configuration
JWT_SECRET=your-very-secure-secret-key

# Server configuration
PORT=3000
```

## Project Startup

### Install Dependencies
```bash
npm install
```

### Start Server
```bash
npm start
```

The server will start and:
1. Connect to MySQL
2. Automatically create tables according to the schema in `schema.sql`
3. Start the web server on port 3000

## API Testing

### Available Routes

#### Server Health
```bash
curl http://localhost:3000/health
```

#### Create User
```bash
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{
    "username": "johndoe",
    "email": "john@example.com"
  }'
```

#### Get All Users
```bash
curl http://localhost:3000/users
```

#### Get User by ID
```bash
curl http://localhost:3000/users/1
```

#### Login (JWT generation)
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com"
  }'
```

#### Protected Route (requires authentication)
```bash
curl http://localhost:3000/protected \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### WebSocket

Test WebSocket connection with a WebSocket client at:
```
ws://localhost:3000/ws
```

## Switch Between SQLite and MySQL

### Use SQLite
In the `.env` file:
```env
USE_MYSQL=false
DB_FILE=./database.sqlite
```

### Use MySQL
In the `.env` file:
```env
USE_MYSQL=true
# ... MySQL configuration
```

## Transaction Management

The MySQL provider supports transactions:

```typescript
// Start transaction
await dbManager.beginTransaction();

try {
    // Database operations
    await dbManager.create('users', userData);
    await dbManager.create('posts', postData);
    
    // Commit transaction
    await dbManager.commitTransaction();
} catch (error) {
    // Rollback transaction on error
    await dbManager.rollbackTransaction();
    throw error;
}
```

## Troubleshooting

### MySQL Connection Error
1. Check that MySQL is running
2. Verify connection information in `.env`
3. Check that user has proper permissions

### "Access denied" Error
1. Check username and password
2. Verify that user exists and has database permissions

### "Database not found" Error
1. Create the database as shown in configuration section
2. Check database name in `.env`

## Monitoring and Logs

The logging system automatically includes:
- Database connections/disconnections
- SQL query execution (in DEBUG mode)
- Database errors
- Transactions (start, commit, rollback)

Logs are saved in the `logs/` folder with daily rotation.

## Performance

To optimize MySQL performance:

1. **Connection Pool**: The provider uses a pool of 10 connections by default
2. **Indexes**: Add indexes on frequently used columns
3. **Cache**: Configure MySQL query cache
4. **Monitoring**: Monitor slow queries with `slow_query_log`

## Security

Security recommendations:

1. **Dedicated User**: Never use root user in production
2. **Strong Password**: Use a complex password
3. **Firewall**: Limit network access to MySQL
4. **SSL/TLS**: Enable encryption for connections
5. **Backup**: Implement a backup strategy

## Migration from SQLite

To migrate an existing SQLite database to MySQL:

1. Export data from SQLite
2. Adapt SQL schema for MySQL (data types, syntax)
3. Import data into MySQL
4. Update configuration (`.env`)
5. Test the application

The provided schema (`schema.sql`) is compatible with both DBMS.

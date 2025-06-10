# MySQL Configuration - uW-Wrap

Complete MySQL database configuration and setup guide for uW-Wrap framework.

## 🎯 Quick Setup

### 1. Environment Variables

Create a `.env` file in your project root:

```bash
# .env
NODE_ENV=production
PORT=3000
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=24h

# MySQL Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=uw_wrap_user
DB_PASSWORD=secure_password
DB_NAME=uw_wrap_db
DB_CONNECTION_LIMIT=10
```

### 2. Application Configuration

```typescript
import { ApplicationBootstrap } from 'uw-wrap';

const config = {
    port: Number(process.env.PORT) || 3000,
    jwtSecret: process.env.JWT_SECRET!,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
    enableLogging: true,
    logLevel: 'info',
    database: {
        type: 'mysql' as const,
        mysql: {
            host: process.env.DB_HOST!,
            port: Number(process.env.DB_PORT) || 3306,
            user: process.env.DB_USER!,
            password: process.env.DB_PASSWORD!,
            database: process.env.DB_NAME!,
            connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 10
        }
    }
};

const app = new ApplicationBootstrap(config);
await app.start();
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

## 🗄️ Database Setup

### 1. Create Database and User

```sql
-- Connect as root
mysql -u root -p

-- Create database
CREATE DATABASE uw_wrap_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create dedicated user (recommended for security)
CREATE USER 'uw_wrap_user'@'localhost' IDENTIFIED BY 'secure_password';
GRANT ALL PRIVILEGES ON uw_wrap_db.* TO 'uw_wrap_user'@'localhost';
FLUSH PRIVILEGES;

-- Verify connection
SHOW DATABASES;
```

### 2. Database Schema

uW-Wrap will automatically create tables through your repositories. Database tables will be created based on your repository configurations.

## ⚙️ Production Configuration

### 1. Connection Pool Options

```typescript
const config = {
    port: Number(process.env.PORT) || 3000,
    jwtSecret: process.env.JWT_SECRET!,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
    enableLogging: true,
    logLevel: 'info',
    database: {
        type: 'mysql' as const,
        mysql: {
            host: process.env.DB_HOST!,
            port: Number(process.env.DB_PORT) || 3306,
            user: process.env.DB_USER!,
            password: process.env.DB_PASSWORD!,
            database: process.env.DB_NAME!,
            connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 10,
            acquireTimeout: 60000,
            timeout: 60000,
            reconnect: true
        }
    }
};
```

### 2. SSL Configuration (Production)

```typescript
const prodConfig = {
    // ...other config
    database: {
        type: 'mysql' as const,
        mysql: {
            host: process.env.DB_HOST!,
            user: process.env.DB_USER!,
            password: process.env.DB_PASSWORD!,
            database: process.env.DB_NAME!,
            ssl: {
                ca: process.env.DB_SSL_CA,
                cert: process.env.DB_SSL_CERT,
                key: process.env.DB_SSL_KEY,
                rejectUnauthorized: true
            }
        }
    }
};
```

---

**MySQL configuration complete! Your uW-Wrap application is ready for production database deployment.** 🚀

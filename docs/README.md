# 📚 Documentation uW-Wrap

Complete documentation for the TypeScript wrapper for uWebSockets.js

## 📋 Table of Contents

### 🚀 [Setup & Configuration](./setup/)
- **[MySQL Configuration](./setup/MYSQL_CONFIG.md)** - Complete MySQL setup and configuration guide

### 📖 [Usage Guides](./guides/)
- **[Wrapper Usage Guide](./guides/WRAPPER_USAGE_GUIDE.md)** - Comprehensive guide for using the wrapper
- **[Repository Guide](./guides/REPOSITORY_GUIDE.md)** - Repository pattern implementation and API reference

### 🏗️ [Architecture](./architecture/)
- **[Error Handler Improvements](./architecture/ERROR_HANDLER_IMPROVEMENTS.md)** - Error handling system documentation

### 📑 [Reference](./reference/)
- **[Project Summary](./reference/PROJECT_SUMMARY.md)** - Executive overview of wrapper capabilities and architecture

---

## 🎯 Quick Start

1. **Installation**: `npm install` or `bun install`
2. **Configuration**: Copy `.env.example` to `.env` and configure your MySQL connection
3. **Usage**: Import and use the wrapper components in your project

```typescript
import { createDatabaseConnection, BaseRepository } from './src';

// Initialize database connection
const db = createDatabaseConnection({
  host: 'localhost',
  user: 'your_user',
  password: 'your_password',
  database: 'your_database'
});

// Use repositories for data access
const userRepo = new BaseRepository(db, 'users');
```

## 📚 Key Features

- **Type-safe database operations** with full TypeScript support
- **Repository pattern** implementation for clean data access
- **Advanced error handling** with structured error responses
- **MySQL integration** with connection pooling and optimization
- **Modular architecture** for easy integration into any project

## 📞 Support

For questions or issues, refer to the appropriate documentation sections above, particularly:
- Start with the [Wrapper Usage Guide](./guides/WRAPPER_USAGE_GUIDE.md) for basic usage
- Check [Repository Guide](./guides/REPOSITORY_GUIDE.md) for data access patterns
- Review [Error Handler Improvements](./architecture/ERROR_HANDLER_IMPROVEMENTS.md) for error handling

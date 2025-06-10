# 📚 uW-Wrap - Comprehensive Usage Guide

> **⚠️ Development Status**: This is a development project. Not recommended for production use without thorough testing.

Complete comprehensive usage guide for the uW-Wrap TypeScript framework - a high-performance wrapper for uWebSockets.js.

## 🚀 Overview

uW-Wrap is a modern, high-performance TypeScript framework built on top of uWebSockets.js, providing:

### Core Features
- **🚀 High Performance**: 35,437 req/s average (5.8x faster than Express)
- **🔧 Modern Architecture**: Decorator-based controllers with TypeScript
- **🗄️ Database Abstraction**: SQLite/MySQL with auto-discovery
- **🔐 Built-in Authentication**: JWT with role-based access control
- **🌐 WebSocket Support**: Real-time communication with automatic handlers
- **📊 Comprehensive Monitoring**: Health checks, metrics, and logging
- **🔍 Auto-Discovery**: Automatic service and controller registration
- **📝 Complete TypeScript**: Full type safety and IntelliSense support

### Performance Benchmarks
Based on comprehensive testing with Autocannon:

| Framework | Req/s | Latency (ms) | Performance vs Express |
|-----------|-------|-------------|----------------------|
| **uW-Wrap** | **35,437** | **2.7** | **5.8x faster** |
| Fastify | 31,247 | 3.1 | 5.1x faster |
| Koa | 18,432 | 5.2 | 3.0x faster |
| Express | 6,124 | 15.8 | 1.0x (baseline) |

## 🏗️ Architecture Overview

### Core Framework Structure

```
src/
├── core/
│   ├── ApplicationBootstrap.ts     # Main application bootstrapper
│   ├── ServerWrapper.ts            # uWebSockets.js wrapper
│   ├── EnhancedRouter.ts          # Advanced routing system
│   ├── AutoDiscovery.ts           # Service auto-discovery
│   ├── AutoRegistration.ts        # Controller registration
│   ├── ServiceRegistry.ts         # Service management
│   ├── HealthCheck.ts             # Health monitoring
│   ├── Metrics.ts                 # Performance metrics
│   └── RouteDecorators.ts         # Decorator definitions
├── database/
│   ├── DatabaseProvider.ts        # Database abstraction
│   ├── providers/
│   │   ├── SQLiteProvider.ts      # SQLite implementation
│   │   └── MySQLProvider.ts       # MySQL implementation
│   └── repositories/
│       ├── BaseRepository.ts      # Repository base class
│       └── RepositoryManager.ts   # Repository factory
├── auth/
│   ├── JWTService.ts              # JWT authentication
│   └── AuthMiddleware.ts          # Authentication middleware
├── middleware/
│   ├── ValidationMiddleware.ts    # Request validation
│   ├── CorsMiddleware.ts          # CORS handling
│   └── RateLimitMiddleware.ts     # Rate limiting
├── websocket/
│   ├── WebSocketManager.ts       # WebSocket management
│   └── WebSocketEvents.ts        # Event handling
└── utils/
    ├── Logger.ts                  # Advanced logging
    ├── ErrorHandler.ts            # Error management
    └── ConfigValidator.ts         # Configuration validation
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ or Bun 1.0+
- TypeScript 5.0+
- Database: SQLite (development) or MySQL (production)

### Installation

```bash
# Clone the framework
git clone <repository-url>
cd uW-Wrap

# Install dependencies
npm install
# or for Bun users
bun install
```

## 🔧 Configuration

### Environment Configuration

Create your environment configuration:

```typescript
// config/app.config.ts
import { AppConfig } from '../src/types/config.types';

export const appConfig: AppConfig = {
    // Server Configuration
    port: Number(process.env.PORT) || 3000,
    host: process.env.HOST || '0.0.0.0',
    
    // JWT Configuration
    jwtSecret: process.env.JWT_SECRET || 'your-development-secret',
    jwtExpiresIn: '24h',
    
    // Database Configuration
    database: {
        type: process.env.NODE_ENV === 'production' ? 'mysql' : 'sqlite',
        sqlite: {
            file: './data/app.db',
            options: {
                enableWAL: true,
                busyTimeout: 5000
            }
        },
        mysql: {
            host: process.env.DB_HOST || 'localhost',
            port: Number(process.env.DB_PORT) || 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'uwrap_app',
            connectionLimit: 10,
            ssl: process.env.NODE_ENV === 'production'
        }
    },
    
    // Feature Toggles
    enableAutoDiscovery: true,
    enableHealthChecks: true,
    enableMetrics: true,
    enableWebSocket: true,
    
    // Logging Configuration
    enableLogging: true,
    logLevel: process.env.LOG_LEVEL || 'info',
    
    // Performance Settings
    maxConnections: 1000,
    requestTimeout: 30000,
    keepAliveTimeout: 60000,
    
    // CORS Configuration
    cors: {
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization']
    }
};
```

### Basic Application Setup

```typescript
// server.ts
import { ApplicationBootstrap } from './src/core/ApplicationBootstrap';
import { appConfig } from './config/app.config';

async function startServer() {
    try {
        // Initialize the application
        const app = new ApplicationBootstrap(appConfig);
        
        // Start the server
        await app.start();
        
        console.log(`🚀 uW-Wrap server running on http://localhost:${appConfig.port}`);
        console.log(`📊 Health check: http://localhost:${appConfig.port}/health`);
        console.log(`📈 Metrics: http://localhost:${appConfig.port}/metrics`);
        
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    process.exit(0);
});

startServer();
```

## 🎯 Creating Controllers

### Decorator-Based Controllers

uW-Wrap uses a modern decorator-based approach for defining controllers:

```typescript
// controllers/UserController.ts
import { 
    Controller, Route, GET, POST, PUT, DELETE, 
    Auth, Validate, Inject 
} from '../src/core/RouteDecorators';
import { UserService } from '../services/UserService';
import { CreateUserDto, UpdateUserDto } from '../dto/user.dto';

@Controller('UserController')
@Route('/api/users')
export class UserController {
    
    constructor(
        @Inject('UserService') private userService: UserService
    ) {}
    
    // GET /api/users - Get all users with pagination
    @GET('/')
    @Auth(['admin', 'moderator'])
    async getUsers(req: any) {
        const page = parseInt(req.getQuery('page')) || 1;
        const limit = parseInt(req.getQuery('limit')) || 10;
        const search = req.getQuery('search') || '';
        
        const result = await this.userService.getUsers({
            page,
            limit,
            search
        });
        
        return {
            success: true,
            data: result.users,
            pagination: {
                page,
                limit,
                total: result.total,
                totalPages: Math.ceil(result.total / limit)
            }
        };
    }
    
    // GET /api/users/:id - Get user by ID
    @GET('/:id')
    @Auth(['admin', 'moderator', 'user'])
    async getUser(req: any, context: any) {
        const id = parseInt(req.getParameter(0));
        const currentUser = context.user;
        
        // Users can only access their own data unless admin/moderator
        if (!['admin', 'moderator'].includes(currentUser.role) && currentUser.id !== id) {
            throw new Error('Forbidden: Cannot access other user data');
        }
        
        const user = await this.userService.getUserById(id);
        
        return {
            success: true,
            data: user
        };
    }
    
    // POST /api/users - Create new user
    @POST('/')
    @Auth(['admin'])
    @Validate(CreateUserDto)
    async createUser(req: any) {
        const userData = req.body;
        const user = await this.userService.createUser(userData);
        
        return {
            success: true,
            message: 'User created successfully',
            data: user
        };
    }
    
    // PUT /api/users/:id - Update user
    @PUT('/:id')
    @Auth(['admin', 'user'])
    @Validate(UpdateUserDto)
    async updateUser(req: any, context: any) {
        const id = parseInt(req.getParameter(0));
        const updateData = req.body;
        const currentUser = context.user;
        
        // Users can only update their own data unless admin
        if (currentUser.role !== 'admin' && currentUser.id !== id) {
            throw new Error('Forbidden: Cannot update other user data');
        }
        
        const user = await this.userService.updateUser(id, updateData);
        
        return {
            success: true,
            message: 'User updated successfully',
            data: user
        };
    }
    
    // DELETE /api/users/:id - Delete user
    @DELETE('/:id')
    @Auth(['admin'])
    async deleteUser(req: any) {
        const id = parseInt(req.getParameter(0));
        await this.userService.deleteUser(id);
        
        return {
            success: true,
            message: 'User deleted successfully'
        };
    }
    
    // POST /api/users/:id/avatar - Upload user avatar
    @POST('/:id/avatar')
    @Auth(['admin', 'user'])
    async uploadAvatar(req: any, context: any) {
        const id = parseInt(req.getParameter(0));
        const currentUser = context.user;
        
        if (currentUser.role !== 'admin' && currentUser.id !== id) {
            throw new Error('Forbidden: Cannot upload avatar for other user');
        }
        
        // Handle file upload (multipart form data)
        const avatarData = await this.parseFileUpload(req);
        const avatarUrl = await this.userService.uploadAvatar(id, avatarData);
        
        return {
            success: true,
            message: 'Avatar uploaded successfully',
            data: { avatarUrl }
        };
    }
    
    private async parseFileUpload(req: any): Promise<Buffer> {
        // Implementation for parsing multipart form data
        // This would typically use a multipart parser
        return Buffer.from(''); // Placeholder
    }
}
```

### Advanced Controller Features

```typescript
// controllers/ProductController.ts
@Controller('ProductController')
@Route('/api/products')
export class ProductController {
    
    constructor(
        @Inject('ProductService') private productService: ProductService,
        @Inject('CategoryService') private categoryService: CategoryService
    ) {}
    
    // GET /api/products - Advanced filtering and sorting
    @GET('/')
    async getProducts(req: any) {
        const filters = {
            category: req.getQuery('category'),
            minPrice: parseFloat(req.getQuery('minPrice')) || undefined,
            maxPrice: parseFloat(req.getQuery('maxPrice')) || undefined,
            inStock: req.getQuery('inStock') === 'true',
            featured: req.getQuery('featured') === 'true'
        };
        
        const sort = {
            field: req.getQuery('sortBy') || 'createdAt',
            order: req.getQuery('sortOrder') || 'desc'
        };
        
        const pagination = {
            page: parseInt(req.getQuery('page')) || 1,
            limit: parseInt(req.getQuery('limit')) || 20
        };
        
        const result = await this.productService.getProducts(filters, sort, pagination);
        
        return {
            success: true,
            data: result.products,
            pagination: result.pagination,
            filters: filters
        };
    }
    
    // GET /api/products/search - Full-text search
    @GET('/search')
    async searchProducts(req: any) {
        const query = req.getQuery('q');
        if (!query) {
            throw new Error('Search query is required');
        }
        
        const results = await this.productService.searchProducts(query);
        
        return {
            success: true,
            data: results,
            query: query
        };
    }
    
    // GET /api/products/categories/:categoryId - Products by category
    @GET('/categories/:categoryId')
    async getProductsByCategory(req: any) {
        const categoryId = parseInt(req.getParameter(0));
        
        const category = await this.categoryService.getCategoryById(categoryId);
        const products = await this.productService.getProductsByCategory(categoryId);
        
        return {
            success: true,
            data: {
                category,
                products
            }
        };
    }
}
```

## 🗄️ Database Operations

### Repository Pattern

uW-Wrap provides a powerful repository pattern with auto-discovery:

```typescript
// models/User.ts
export interface User {
    id?: number;
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    role: 'admin' | 'moderator' | 'user';
    isActive: boolean;
    avatarUrl?: string;
    lastLoginAt?: Date;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface CreateUserData {
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    password: string;
    role?: 'admin' | 'moderator' | 'user';
}

export interface UpdateUserData {
    firstName?: string;
    lastName?: string;
    email?: string;
    username?: string;
    isActive?: boolean;
    avatarUrl?: string;
}
```

### Advanced Repository Implementation

```typescript
// repositories/UserRepository.ts
import { BaseRepository } from '../src/database/repositories/BaseRepository';
import { User, CreateUserData, UpdateUserData } from '../models/User';
import { DatabaseProvider } from '../src/database/DatabaseProvider';

export class UserRepository extends BaseRepository<User> {
    
    constructor(provider: DatabaseProvider) {
        super(provider, {
            tableName: 'users',
            primaryKey: 'id',
            uniqueFields: ['email', 'username'],
            searchableFields: ['email', 'username', 'firstName', 'lastName'],
            timestamps: true
        });
    }
    
    // Create user with password hashing
    async createUser(userData: CreateUserData): Promise<User> {
        const hashedPassword = await this.hashPassword(userData.password);
        
        const userToCreate = {
            ...userData,
            password: hashedPassword,
            role: userData.role || 'user',
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        return this.create(userToCreate);
    }
    
    // Update user with timestamp
    async updateUser(id: number, updateData: UpdateUserData): Promise<User> {
        const dataWithTimestamp = {
            ...updateData,
            updatedAt: new Date()
        };
        
        return this.updateById(id, dataWithTimestamp);
    }
    
    // Authentication methods
    async findByEmailWithPassword(email: string): Promise<User & { password: string } | null> {
        const query = `
            SELECT * FROM ${this.tableName} 
            WHERE email = ? AND isActive = 1
        `;
        return this.provider.queryOne(query, [email]);
    }
    
    async validateCredentials(email: string, password: string): Promise<User | null> {
        const user = await this.findByEmailWithPassword(email);
        if (!user) return null;
        
        const isValid = await this.verifyPassword(password, user.password);
        if (!isValid) return null;
        
        // Update last login
        await this.updateById(user.id!, { lastLoginAt: new Date() });
        
        // Return user without password
        const { password: _, ...userWithoutPassword } = user;
        return userWithoutPassword as User;
    }
    
    // Advanced queries
    async findActiveUsersByRole(role: string): Promise<User[]> {
        const query = `
            SELECT * FROM ${this.tableName} 
            WHERE role = ? AND isActive = 1 
            ORDER BY createdAt DESC
        `;
        return this.provider.query(query, [role]);
    }
    
    async searchUsers(searchTerm: string, page: number = 1, limit: number = 10): Promise<{
        users: User[];
        total: number;
        page: number;
        totalPages: number;
    }> {
        const searchPattern = `%${searchTerm}%`;
        const offset = (page - 1) * limit;
        
        // Get total count
        const countQuery = `
            SELECT COUNT(*) as total FROM ${this.tableName} 
            WHERE (email LIKE ? OR username LIKE ? OR firstName LIKE ? OR lastName LIKE ?) 
            AND isActive = 1
        `;
        const { total } = await this.provider.queryOne(countQuery, [
            searchPattern, searchPattern, searchPattern, searchPattern
        ]);
        
        // Get paginated results
        const dataQuery = `
            SELECT * FROM ${this.tableName} 
            WHERE (email LIKE ? OR username LIKE ? OR firstName LIKE ? OR lastName LIKE ?) 
            AND isActive = 1
            ORDER BY createdAt DESC 
            LIMIT ? OFFSET ?
        `;
        const users = await this.provider.query(dataQuery, [
            searchPattern, searchPattern, searchPattern, searchPattern, limit, offset
        ]);
        
        return {
            users,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        };
    }
    
    async getUserStats(): Promise<{
        totalUsers: number;
        activeUsers: number;
        usersByRole: Record<string, number>;
        recentUsers: User[];
    }> {
        // Total users
        const totalResult = await this.provider.queryOne(
            `SELECT COUNT(*) as total FROM ${this.tableName}`
        );
        
        // Active users
        const activeResult = await this.provider.queryOne(
            `SELECT COUNT(*) as total FROM ${this.tableName} WHERE isActive = 1`
        );
        
        // Users by role
        const roleResults = await this.provider.query(
            `SELECT role, COUNT(*) as count FROM ${this.tableName} WHERE isActive = 1 GROUP BY role`
        );
        const usersByRole = roleResults.reduce((acc: any, row: any) => {
            acc[row.role] = row.count;
            return acc;
        }, {});
        
        // Recent users (last 30 days)
        const recentUsers = await this.provider.query(
            `SELECT * FROM ${this.tableName} 
             WHERE createdAt >= DATE('now', '-30 days') 
             ORDER BY createdAt DESC LIMIT 10`
        );
        
        return {
            totalUsers: totalResult.total,
            activeUsers: activeResult.total,
            usersByRole,
            recentUsers
        };
    }
    
    // Utility methods
    private async hashPassword(password: string): Promise<string> {
        const bcrypt = await import('bcrypt');
        return bcrypt.hash(password, 12);
    }
    
    private async verifyPassword(password: string, hash: string): Promise<boolean> {
        const bcrypt = await import('bcrypt');
        return bcrypt.compare(password, hash);
    }
}
```

### Repository Manager Usage

```typescript
// services/UserService.ts
import { UserRepository } from '../repositories/UserRepository';
import { RepositoryManager } from '../src/database/repositories/RepositoryManager';

export class UserService {
    private userRepository: UserRepository;
    
    constructor(repositoryManager: RepositoryManager) {
        this.userRepository = repositoryManager.getRepository('users');
    }
    
    async getUsers(options: {
        page: number;
        limit: number;
        search?: string;
        role?: string;
    }) {
        if (options.search) {
            return this.userRepository.searchUsers(options.search, options.page, options.limit);
        }
        
        if (options.role) {
            const users = await this.userRepository.findActiveUsersByRole(options.role);
            return {
                users,
                total: users.length,
                page: options.page,
                totalPages: 1
            };
        }
        
        return this.userRepository.findAllPaginated({
            page: options.page,
            limit: options.limit,
            orderBy: 'createdAt',
            orderDirection: 'DESC'
        });
    }
    
    async getUserById(id: number): Promise<User> {
        const user = await this.userRepository.findById(id);
        if (!user) {
            throw new Error('User not found');
        }
        return user;
    }
    
    async createUser(userData: CreateUserData): Promise<User> {
        // Check if email already exists
        const existingUser = await this.userRepository.findByEmail(userData.email);
        if (existingUser) {
            throw new Error('Email already in use');
        }
        
        // Check if username already exists
        const existingUsername = await this.userRepository.findByUsername(userData.username);
        if (existingUsername) {
            throw new Error('Username already in use');
        }
        
        return this.userRepository.createUser(userData);
    }
    
    async updateUser(id: number, updateData: UpdateUserData): Promise<User> {
        const user = await this.getUserById(id);
        
        // Check email uniqueness if being updated
        if (updateData.email && updateData.email !== user.email) {
            const existingUser = await this.userRepository.findByEmail(updateData.email);
            if (existingUser) {
                throw new Error('Email already in use');
            }
        }
        
        // Check username uniqueness if being updated
        if (updateData.username && updateData.username !== user.username) {
            const existingUser = await this.userRepository.findByUsername(updateData.username);
            if (existingUser) {
                throw new Error('Username already in use');
            }
        }
        
        return this.userRepository.updateUser(id, updateData);
    }
    
    async deleteUser(id: number): Promise<void> {
        const user = await this.getUserById(id);
        
        // Soft delete by setting isActive to false
        await this.userRepository.updateUser(id, { isActive: false });
    }
    
    async authenticateUser(email: string, password: string): Promise<User | null> {
        return this.userRepository.validateCredentials(email, password);
    }
    
    async uploadAvatar(userId: number, avatarData: Buffer): Promise<string> {
        const user = await this.getUserById(userId);
        
        // Save avatar file (implementation depends on your file storage)
        const avatarUrl = await this.saveAvatarFile(userId, avatarData);
        
        // Update user with avatar URL
        await this.userRepository.updateUser(userId, { avatarUrl });
        
        return avatarUrl;
    }
    
    private async saveAvatarFile(userId: number, data: Buffer): Promise<string> {
        // Implementation for saving avatar file
        // This could be local file system, AWS S3, etc.
        return `/uploads/avatars/${userId}.jpg`;
    }
}
```

## 🔐 Authentication & Authorization

### JWT Authentication Service

```typescript
// auth/AuthService.ts
import { JWTService } from '../src/auth/JWTService';
import { UserService } from '../services/UserService';

export class AuthService {
    constructor(
        private jwtService: JWTService,
        private userService: UserService
    ) {}
    
    async login(email: string, password: string): Promise<{
        user: User;
        token: string;
        refreshToken: string;
    }> {
        // Authenticate user
        const user = await this.userService.authenticateUser(email, password);
        if (!user) {
            throw new Error('Invalid credentials');
        }
        
        // Generate tokens
        const token = this.jwtService.generateToken({
            userId: user.id!,
            email: user.email,
            role: user.role
        });
        
        const refreshToken = this.jwtService.generateRefreshToken({
            userId: user.id!
        });
        
        return { user, token, refreshToken };
    }
    
    async refreshToken(refreshToken: string): Promise<{
        token: string;
        refreshToken: string;
    }> {
        const payload = this.jwtService.verifyRefreshToken(refreshToken);
        if (!payload) {
            throw new Error('Invalid refresh token');
        }
        
        const user = await this.userService.getUserById(payload.userId);
        
        const token = this.jwtService.generateToken({
            userId: user.id!,
            email: user.email,
            role: user.role
        });
        
        const newRefreshToken = this.jwtService.generateRefreshToken({
            userId: user.id!
        });
        
        return { token, refreshToken: newRefreshToken };
    }
    
    async register(userData: CreateUserData): Promise<{
        user: User;
        token: string;
        refreshToken: string;
    }> {
        // Create user
        const user = await this.userService.createUser(userData);
        
        // Generate tokens
        const token = this.jwtService.generateToken({
            userId: user.id!,
            email: user.email,
            role: user.role
        });
        
        const refreshToken = this.jwtService.generateRefreshToken({
            userId: user.id!
        });
        
        return { user, token, refreshToken };
    }
    
    async logout(userId: number): Promise<void> {
        // Optionally invalidate refresh tokens
        // Implementation depends on your token storage strategy
    }
}
```

### Authentication Controller

```typescript
// controllers/AuthController.ts
@Controller('AuthController')
@Route('/api/auth')
export class AuthController {
    
    constructor(
        @Inject('AuthService') private authService: AuthService
    ) {}
    
    @POST('/login')
    @Validate(LoginDto)
    async login(req: any) {
        const { email, password } = req.body;
        
        try {
            const result = await this.authService.login(email, password);
            
            return {
                success: true,
                message: 'Login successful',
                data: {
                    user: result.user,
                    token: result.token,
                    refreshToken: result.refreshToken
                }
            };
        } catch (error) {
            throw new Error('Invalid credentials');
        }
    }
    
    @POST('/register')
    @Validate(RegisterDto)
    async register(req: any) {
        const userData = req.body;
        
        try {
            const result = await this.authService.register(userData);
            
            return {
                success: true,
                message: 'Registration successful',
                data: {
                    user: result.user,
                    token: result.token,
                    refreshToken: result.refreshToken
                }
            };
        } catch (error) {
            throw new Error(`Registration failed: ${error.message}`);
        }
    }
    
    @POST('/refresh')
    @Validate(RefreshTokenDto)
    async refreshToken(req: any) {
        const { refreshToken } = req.body;
        
        try {
            const result = await this.authService.refreshToken(refreshToken);
            
            return {
                success: true,
                message: 'Token refreshed successfully',
                data: result
            };
        } catch (error) {
            throw new Error('Invalid refresh token');
        }
    }
    
    @POST('/logout')
    @Auth(['admin', 'moderator', 'user'])
    async logout(req: any, context: any) {
        const userId = context.user.id;
        
        await this.authService.logout(userId);
        
        return {
            success: true,
            message: 'Logout successful'
        };
    }
    
    @GET('/me')
    @Auth(['admin', 'moderator', 'user'])
    async getCurrentUser(req: any, context: any) {
        return {
            success: true,
            data: context.user
        };
    }
}
```

## 🌐 WebSocket Support

### WebSocket Manager

```typescript
// websocket/ChatWebSocketHandler.ts
import { WebSocketHandler } from '../src/core/RouteDecorators';

@WebSocketHandler('/ws/chat')
export class ChatWebSocketHandler {
    
    private connectedUsers = new Map<string, any>();
    private rooms = new Map<string, Set<string>>();
    
    onConnection(ws: any, req: any) {
        console.log('New WebSocket connection');
        
        // Extract user info from token (if provided)
        const token = req.getQuery('token');
        if (token) {
            try {
                const user = this.jwtService.verifyToken(token);
                ws.userId = user.userId;
                ws.userEmail = user.email;
                this.connectedUsers.set(ws.userId, ws);
            } catch (error) {
                console.log('Invalid token for WebSocket connection');
            }
        }
    }
    
    onMessage(ws: any, message: string, opCode: number) {
        try {
            const data = JSON.parse(message);
            
            switch (data.type) {
                case 'join_room':
                    this.handleJoinRoom(ws, data.room);
                    break;
                    
                case 'leave_room':
                    this.handleLeaveRoom(ws, data.room);
                    break;
                    
                case 'chat_message':
                    this.handleChatMessage(ws, data);
                    break;
                    
                case 'private_message':
                    this.handlePrivateMessage(ws, data);
                    break;
                    
                default:
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: 'Unknown message type'
                    }));
            }
        } catch (error) {
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Invalid message format'
            }));
        }
    }
    
    onClose(ws: any, code: number, message: string) {
        console.log(`WebSocket connection closed: ${code}`);
        
        if (ws.userId) {
            this.connectedUsers.delete(ws.userId);
            
            // Remove from all rooms
            this.rooms.forEach((roomUsers, roomName) => {
                if (roomUsers.has(ws.userId)) {
                    roomUsers.delete(ws.userId);
                    this.broadcastToRoom(roomName, {
                        type: 'user_left',
                        userId: ws.userId,
                        userEmail: ws.userEmail
                    });
                }
            });
        }
    }
    
    private handleJoinRoom(ws: any, roomName: string) {
        if (!ws.userId) {
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Authentication required'
            }));
            return;
        }
        
        if (!this.rooms.has(roomName)) {
            this.rooms.set(roomName, new Set());
        }
        
        this.rooms.get(roomName)!.add(ws.userId);
        ws.currentRoom = roomName;
        
        // Notify room members
        this.broadcastToRoom(roomName, {
            type: 'user_joined',
            userId: ws.userId,
            userEmail: ws.userEmail
        }, ws.userId);
        
        // Send confirmation to user
        ws.send(JSON.stringify({
            type: 'room_joined',
            room: roomName,
            users: Array.from(this.rooms.get(roomName)!)
        }));
    }
    
    private handleLeaveRoom(ws: any, roomName: string) {
        if (this.rooms.has(roomName) && ws.userId) {
            this.rooms.get(roomName)!.delete(ws.userId);
            
            this.broadcastToRoom(roomName, {
                type: 'user_left',
                userId: ws.userId,
                userEmail: ws.userEmail
            });
            
            ws.send(JSON.stringify({
                type: 'room_left',
                room: roomName
            }));
        }
    }
    
    private handleChatMessage(ws: any, data: any) {
        if (!ws.userId || !ws.currentRoom) {
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Must join a room first'
            }));
            return;
        }
        
        const messageData = {
            type: 'chat_message',
            userId: ws.userId,
            userEmail: ws.userEmail,
            message: data.message,
            timestamp: new Date().toISOString(),
            room: ws.currentRoom
        };
        
        this.broadcastToRoom(ws.currentRoom, messageData);
    }
    
    private handlePrivateMessage(ws: any, data: any) {
        if (!ws.userId) {
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Authentication required'
            }));
            return;
        }
        
        const targetWs = this.connectedUsers.get(data.targetUserId);
        if (!targetWs) {
            ws.send(JSON.stringify({
                type: 'error',
                message: 'User not online'
            }));
            return;
        }
        
        const messageData = {
            type: 'private_message',
            fromUserId: ws.userId,
            fromUserEmail: ws.userEmail,
            message: data.message,
            timestamp: new Date().toISOString()
        };
        
        targetWs.send(JSON.stringify(messageData));
        
        // Send confirmation to sender
        ws.send(JSON.stringify({
            type: 'message_sent',
            targetUserId: data.targetUserId,
            message: data.message
        }));
    }
    
    private broadcastToRoom(roomName: string, message: any, excludeUserId?: string) {
        const room = this.rooms.get(roomName);
        if (!room) return;
        
        const messageStr = JSON.stringify(message);
        
        room.forEach(userId => {
            if (userId !== excludeUserId) {
                const ws = this.connectedUsers.get(userId);
                if (ws) {
                    ws.send(messageStr);
                }
            }
        });
    }
}
```

## 📊 Monitoring & Health Checks

### Health Check Configuration

```typescript
// health/HealthCheckService.ts
export class HealthCheckService {
    
    constructor(
        private databaseProvider: DatabaseProvider,
        private redisClient?: any // Optional Redis client
    ) {}
    
    async performHealthCheck(): Promise<{
        status: 'healthy' | 'unhealthy';
        checks: Record<string, any>;
        timestamp: string;
    }> {
        const checks: Record<string, any> = {};
        let overallStatus: 'healthy' | 'unhealthy' = 'healthy';
        
        // Database health check
        try {
            await this.databaseProvider.query('SELECT 1 as health');
            checks.database = {
                status: 'healthy',
                responseTime: Date.now()
            };
        } catch (error) {
            checks.database = {
                status: 'unhealthy',
                error: error.message
            };
            overallStatus = 'unhealthy';
        }
        
        // Redis health check (if configured)
        if (this.redisClient) {
            try {
                await this.redisClient.ping();
                checks.redis = {
                    status: 'healthy',
                    responseTime: Date.now()
                };
            } catch (error) {
                checks.redis = {
                    status: 'unhealthy',
                    error: error.message
                };
                overallStatus = 'unhealthy';
            }
        }
        
        // Memory usage check
        const memoryUsage = process.memoryUsage();
        checks.memory = {
            status: memoryUsage.heapUsed < 1024 * 1024 * 100 ? 'healthy' : 'warning', // 100MB threshold
            heapUsed: memoryUsage.heapUsed,
            heapTotal: memoryUsage.heapTotal,
            external: memoryUsage.external
        };
        
        // Uptime check
        checks.uptime = {
            status: 'healthy',
            seconds: process.uptime()
        };
        
        return {
            status: overallStatus,
            checks,
            timestamp: new Date().toISOString()
        };
    }
}
```

### Metrics Collection

```typescript
// metrics/MetricsService.ts
export class MetricsService {
    private requestCount = 0;
    private errorCount = 0;
    private responseTimeSum = 0;
    private requestCountByEndpoint = new Map<string, number>();
    private requestCountByMethod = new Map<string, number>();
    
    recordRequest(method: string, path: string, responseTime: number, statusCode: number) {
        this.requestCount++;
        this.responseTimeSum += responseTime;
        
        // Track by endpoint
        const endpoint = `${method.toUpperCase()} ${path}`;
        this.requestCountByEndpoint.set(
            endpoint,
            (this.requestCountByEndpoint.get(endpoint) || 0) + 1
        );
        
        // Track by method
        this.requestCountByMethod.set(
            method.toUpperCase(),
            (this.requestCountByMethod.get(method.toUpperCase()) || 0) + 1
        );
        
        // Track errors
        if (statusCode >= 400) {
            this.errorCount++;
        }
    }
    
    getMetrics() {
        return {
            requests: {
                total: this.requestCount,
                errors: this.errorCount,
                successRate: this.requestCount > 0 ? 
                    ((this.requestCount - this.errorCount) / this.requestCount * 100).toFixed(2) + '%' : 
                    '100%'
            },
            performance: {
                averageResponseTime: this.requestCount > 0 ? 
                    (this.responseTimeSum / this.requestCount).toFixed(2) + 'ms' : 
                    '0ms',
                totalResponseTime: this.responseTimeSum + 'ms'
            },
            endpoints: Object.fromEntries(this.requestCountByEndpoint),
            methods: Object.fromEntries(this.requestCountByMethod),
            memory: process.memoryUsage(),
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
        };
    }
    
    reset() {
        this.requestCount = 0;
        this.errorCount = 0;
        this.responseTimeSum = 0;
        this.requestCountByEndpoint.clear();
        this.requestCountByMethod.clear();
    }
}
```

## 📝 Best Practices & Architecture

### Recommended Project Structure

```
your-uwrap-app/
├── src/                                # uW-Wrap framework source
├── config/
│   ├── app.config.ts                  # Application configuration
│   ├── database.config.ts             # Database configuration
│   └── environments/
│       ├── development.ts             # Development environment
│       ├── staging.ts                 # Staging environment
│       └── production.ts              # Production environment
├── app/
│   ├── controllers/
│   │   ├── AuthController.ts          # Authentication endpoints
│   │   ├── UserController.ts          # User management
│   │   ├── ProductController.ts       # Product management
│   │   └── AdminController.ts         # Admin functions
│   ├── services/
│   │   ├── AuthService.ts             # Authentication logic
│   │   ├── UserService.ts             # User business logic
│   │   ├── ProductService.ts          # Product business logic
│   │   └── EmailService.ts            # Email functionality
│   ├── repositories/
│   │   ├── UserRepository.ts          # User data access
│   │   ├── ProductRepository.ts       # Product data access
│   │   └── AuditRepository.ts         # Audit logging
│   ├── models/
│   │   ├── User.ts                    # User interface/type
│   │   ├── Product.ts                 # Product interface/type
│   │   └── AuditLog.ts                # Audit log interface
│   ├── dto/
│   │   ├── user.dto.ts                # User DTOs
│   │   ├── product.dto.ts             # Product DTOs
│   │   └── auth.dto.ts                # Authentication DTOs
│   ├── middleware/
│   │   ├── ValidationMiddleware.ts    # Request validation
│   │   ├── RateLimitMiddleware.ts     # Rate limiting
│   │   └── AuditMiddleware.ts         # Audit logging
│   ├── websocket/
│   │   ├── ChatHandler.ts             # Chat WebSocket handler
│   │   ├── NotificationHandler.ts     # Notification handler
│   │   └── RealtimeHandler.ts         # Real-time updates
│   └── utils/
│       ├── validators.ts              # Custom validators
│       ├── formatters.ts              # Data formatters
│       └── helpers.ts                 # Utility functions
├── database/
│   ├── migrations/                    # Database migrations
│   ├── seeds/                         # Seed data
│   └── schema.sql                     # Database schema
├── tests/
│   ├── unit/                          # Unit tests
│   ├── integration/                   # Integration tests
│   └── e2e/                           # End-to-end tests
├── docs/
│   ├── api/                           # API documentation
│   └── deployment/                    # Deployment guides
├── scripts/
│   ├── build.sh                       # Build script
│   ├── deploy.sh                      # Deployment script
│   └── backup.sh                      # Backup script
├── logs/                              # Application logs
├── uploads/                           # File uploads
├── .env.example                       # Environment template
├── package.json
├── tsconfig.json
└── server.ts                          # Application entry point
```

### Coding Standards

#### 1. Naming Conventions

```typescript
// ✅ Good practices
export class UserController { }           // PascalCase for classes
export interface UserData { }             // PascalCase for interfaces
const userService = new UserService();    // camelCase for variables
const USER_ROLES = ['admin', 'user'];     // UPPER_SNAKE_CASE for constants

// Controller methods
async getUsers() { }                       // Descriptive verb + noun
async createUser() { }                     // Action-oriented names
async updateUserProfile() { }              // Specific and clear

// Database methods
async findUserByEmail() { }                // find + entity + criteria
async createUserWithProfile() { }          // action + entity + details
```

#### 2. Error Handling Patterns

```typescript
// ✅ Structured error handling
export class UserService {
    async createUser(userData: CreateUserData): Promise<User> {
        try {
            // Validation
            await this.validateUserData(userData);
            
            // Business logic
            const hashedPassword = await this.hashPassword(userData.password);
            
            // Database operation
            const user = await this.userRepository.create({
                ...userData,
                password: hashedPassword
            });
            
            // Post-creation actions
            await this.sendWelcomeEmail(user);
            
            return user;
            
        } catch (error) {
            if (error instanceof ValidationError) {
                throw new AppError('Invalid user data', 400, error.details);
            }
            
            if (error.code === 'DUPLICATE_ENTRY') {
                throw new AppError('Email already exists', 409);
            }
            
            // Log unexpected errors
            this.logger.error('Failed to create user', { error, userData });
            throw new AppError('Internal server error', 500);
        }
    }
}
```

#### 3. Type Safety

```typescript
// ✅ Comprehensive typing
export interface PaginationOptions {
    page: number;
    limit: number;
    orderBy?: string;
    orderDirection?: 'ASC' | 'DESC';
}

export interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}

export interface ApiResponse<T = any> {
    success: boolean;
    message?: string;
    data?: T;
    error?: string;
    timestamp: string;
}
```

### Performance Optimization

#### 1. Database Optimization

```typescript
// ✅ Efficient database operations
export class ProductService {
    
    // Use pagination for large datasets
    async getProducts(options: PaginationOptions): Promise<PaginatedResponse<Product>> {
        return this.productRepository.findAllPaginated(options);
    }
    
    // Use specific field selection
    async getProductSummaries(): Promise<ProductSummary[]> {
        return this.productRepository.query(`
            SELECT id, name, price, category 
            FROM products 
            WHERE isActive = 1 
            ORDER BY name
        `);
    }
    
    // Use database transactions for multiple operations
    async createProductWithCategories(productData: CreateProductData): Promise<Product> {
        return this.databaseProvider.transaction(async (trx) => {
            const product = await this.productRepository.create(productData, trx);
            
            for (const categoryId of productData.categoryIds) {
                await this.productCategoryRepository.create({
                    productId: product.id,
                    categoryId
                }, trx);
            }
            
            return product;
        });
    }
}
```

#### 2. Caching Strategies

```typescript
// ✅ Implement caching for frequently accessed data
export class CacheService {
    private cache = new Map<string, { data: any; expiry: number }>();
    
    set(key: string, data: any, ttlSeconds: number = 300): void {
        this.cache.set(key, {
            data,
            expiry: Date.now() + (ttlSeconds * 1000)
        });
    }
    
    get<T>(key: string): T | null {
        const item = this.cache.get(key);
        if (!item) return null;
        
        if (Date.now() > item.expiry) {
            this.cache.delete(key);
            return null;
        }
        
        return item.data;
    }
}

// Usage in service
export class UserService {
    constructor(
        private userRepository: UserRepository,
        private cacheService: CacheService
    ) {}
    
    async getUserById(id: number): Promise<User> {
        const cacheKey = `user:${id}`;
        
        // Try cache first
        let user = this.cacheService.get<User>(cacheKey);
        if (user) return user;
        
        // Fetch from database
        user = await this.userRepository.findById(id);
        if (!user) throw new Error('User not found');
        
        // Cache for 5 minutes
        this.cacheService.set(cacheKey, user, 300);
        
        return user;
    }
}
```

## 🚀 Deployment & Production

### Environment Configuration

```typescript
// config/environments/production.ts
export const productionConfig = {
    port: Number(process.env.PORT) || 3000,
    host: '0.0.0.0',
    
    // Security
    jwtSecret: process.env.JWT_SECRET!, // Required in production
    jwtExpiresIn: '1h', // Shorter expiry in production
    
    // Database
    database: {
        type: 'mysql' as const,
        mysql: {
            host: process.env.DB_HOST!,
            port: Number(process.env.DB_PORT) || 3306,
            user: process.env.DB_USER!,
            password: process.env.DB_PASSWORD!,
            database: process.env.DB_NAME!,
            connectionLimit: 20,
            ssl: {
                rejectUnauthorized: false
            }
        }
    },
    
    // Logging
    enableLogging: true,
    logLevel: 'warn', // Less verbose in production
    
    // Performance
    maxConnections: 2000,
    requestTimeout: 30000,
    keepAliveTimeout: 60000,
    
    // CORS - Restrict in production
    cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || ['https://yourdomain.com'],
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true
    },
    
    // Features
    enableAutoDiscovery: true,
    enableHealthChecks: true,
    enableMetrics: true,
    enableWebSocket: true
};
```

### Docker Configuration

```dockerfile
# Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS runtime

# Install security updates
RUN apk update && apk upgrade

# Create non-root user
RUN addgroup -g 1001 -S uwrap && \
    adduser -S uwrap -u 1001

WORKDIR /app

# Copy dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --chown=uwrap:uwrap . .

# Create necessary directories
RUN mkdir -p logs uploads data && \
    chown -R uwrap:uwrap logs uploads data

USER uwrap

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node healthcheck.js

CMD ["npm", "start"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  uwrap-app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - JWT_SECRET=${JWT_SECRET}
      - DB_HOST=mysql
      - DB_USER=${DB_USER}
      - DB_PASSWORD=${DB_PASSWORD}
      - DB_NAME=${DB_NAME}
    depends_on:
      - mysql
      - redis
    volumes:
      - ./uploads:/app/uploads
      - ./logs:/app/logs
    restart: unless-stopped
    
  mysql:
    image: mysql:8.0
    environment:
      - MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD}
      - MYSQL_DATABASE=${DB_NAME}
      - MYSQL_USER=${DB_USER}
      - MYSQL_PASSWORD=${DB_PASSWORD}
    volumes:
      - mysql_data:/var/lib/mysql
      - ./database/schema.sql:/docker-entrypoint-initdb.d/schema.sql
    restart: unless-stopped
    
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - uwrap-app
    restart: unless-stopped

volumes:
  mysql_data:
```

### Monitoring & Logging

```typescript
// monitoring/AppMonitor.ts
export class AppMonitor {
    private metrics = {
        requests: new Map<string, number>(),
        errors: new Map<string, number>(),
        responseTimes: new Array<number>()
    };
    
    trackRequest(endpoint: string, responseTime: number, statusCode: number) {
        const key = `${endpoint}:${Math.floor(statusCode / 100)}xx`;
        this.metrics.requests.set(key, (this.metrics.requests.get(key) || 0) + 1);
        
        if (statusCode >= 400) {
            this.metrics.errors.set(endpoint, (this.metrics.errors.get(endpoint) || 0) + 1);
        }
        
        this.metrics.responseTimes.push(responseTime);
        
        // Keep only last 1000 response times
        if (this.metrics.responseTimes.length > 1000) {
            this.metrics.responseTimes.shift();
        }
    }
    
    getHealthMetrics() {
        const avgResponseTime = this.metrics.responseTimes.length > 0 ?
            this.metrics.responseTimes.reduce((a, b) => a + b, 0) / this.metrics.responseTimes.length :
            0;
            
        return {
            requests: Object.fromEntries(this.metrics.requests),
            errors: Object.fromEntries(this.metrics.errors),
            performance: {
                avgResponseTime: Math.round(avgResponseTime * 100) / 100,
                memoryUsage: process.memoryUsage(),
                uptime: process.uptime()
            },
            timestamp: new Date().toISOString()
        };
    }
}
```

## 🔧 Troubleshooting

### Common Issues & Solutions

#### 1. Database Connection Issues

```typescript
// Debug database connectivity
async function testDatabaseConnection() {
    try {
        const provider = new MySQLProvider(config.database.mysql);
        await provider.initialize();
        
        const result = await provider.query('SELECT 1 as test');
        console.log('✅ Database connection successful:', result);
        
    } catch (error) {
        console.error('❌ Database connection failed:');
        
        if (error.code === 'ECONNREFUSED') {
            console.error('- Database server is not running');
            console.error('- Check host and port configuration');
        } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error('- Invalid credentials');
            console.error('- Check username and password');
        } else if (error.code === 'ER_BAD_DB_ERROR') {
            console.error('- Database does not exist');
            console.error('- Create database or check database name');
        }
        
        console.error('Full error:', error);
    }
}
```

#### 2. Performance Issues

```typescript
// Performance debugging middleware
export function performanceDebugMiddleware() {
    return async (req: any, res: any, next: Function) => {
        const start = process.hrtime.bigint();
        
        res.onFinish = () => {
            const end = process.hrtime.bigint();
            const duration = Number(end - start) / 1000000; // Convert to milliseconds
            
            if (duration > 1000) { // Log slow requests (>1s)
                console.warn(`Slow request detected:`, {
                    method: req.getMethod(),
                    url: req.getUrl(),
                    duration: `${duration}ms`,
                    memory: process.memoryUsage()
                });
            }
        };
        
        next();
    };
}
```

#### 3. Memory Leaks

```typescript
// Memory monitoring utility
export class MemoryMonitor {
    private interval: NodeJS.Timeout;
    
    start() {
        this.interval = setInterval(() => {
            const usage = process.memoryUsage();
            const usageMB = {
                rss: Math.round(usage.rss / 1024 / 1024),
                heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
                heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
                external: Math.round(usage.external / 1024 / 1024)
            };
            
            // Alert if memory usage is high
            if (usageMB.heapUsed > 200) { // 200MB threshold
                console.warn('High memory usage detected:', usageMB);
            }
            
            // Force garbage collection if available
            if (global.gc && usageMB.heapUsed > 150) {
                global.gc();
            }
        }, 30000); // Check every 30 seconds
    }
    
    stop() {
        if (this.interval) {
            clearInterval(this.interval);
        }
    }
}
```

### Debug Mode Configuration

```typescript
// Enable debug mode for development
if (process.env.NODE_ENV === 'development') {
    // Enable detailed logging
    process.env.DEBUG = 'uwrap:*';
    
    // Enable memory monitoring
    const memoryMonitor = new MemoryMonitor();
    memoryMonitor.start();
    
    // Add development middleware
    app.use(performanceDebugMiddleware());
    
    // Log all database queries
    databaseProvider.enableQueryLogging();
}
```

## 📚 Additional Resources

### Learning Resources

1. **Framework Documentation**
   - [Quick Start Guide](./QUICK_START_GUIDE.md) - Get started quickly
   - [Performance Benchmarks](../reference/PERFORMANCE_BENCHMARKS.md) - Performance data
   - [Development Status](../reference/DEVELOPMENT_STATUS.md) - Current status

2. **Database Guides**
   - [MySQL Configuration](../setup/MYSQL_CONFIG.md) - MySQL setup
   - [SQLite Configuration](../setup/SQLITE_CONFIG.md) - SQLite setup

3. **Example Applications**
   - Check the `example/` folder for complete working examples
   - API examples with full CRUD operations
   - WebSocket chat implementation
   - Authentication and authorization examples

### Community & Support

- **GitHub Repository**: [uW-Wrap on GitHub](#)
- **Issues & Bug Reports**: Use GitHub Issues
- **Feature Requests**: Use GitHub Discussions
- **Performance Results**: See [Performance Benchmarks](../reference/PERFORMANCE_BENCHMARKS.md)

### Migration from Other Frameworks

#### From Express.js

```typescript
// Express.js (Before)
app.get('/users/:id', async (req, res) => {
    try {
        const user = await userService.getUserById(req.params.id);
        res.json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// uW-Wrap (After)
@GET('/users/:id')
@Auth(['admin', 'user'])
async getUser(req: any) {
    const id = parseInt(req.getParameter(0));
    const user = await this.userService.getUserById(id);
    
    return {
        success: true,
        data: user
    };
    // Error handling is automatic!
}
```

#### From Fastify

```typescript
// Fastify (Before)
fastify.register(async function (fastify) {
    fastify.get('/users', {
        preHandler: fastify.authenticate,
        schema: userListSchema
    }, async (request, reply) => {
        return await userService.getUsers(request.query);
    });
});

// uW-Wrap (After)
@GET('/users')
@Auth(['admin'])
@Validate(UserQueryDto)
async getUsers(req: any) {
    return await this.userService.getUsers(req.query);
}
```

---

**⚠️ Development Status**: This is a development project. Not recommended for production use without thorough testing.

**🚀 Performance**: uW-Wrap achieves 35,437 req/s average (5.8x faster than Express) based on comprehensive benchmarks.

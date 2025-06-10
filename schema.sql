-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Example table for demonstrating CRUD operations
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    description VARCHAR(255) NOT NULL,
    category_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample data
INSERT OR IGNORE INTO users (username, email, password_hash, name, role) VALUES 
('admin', 'admin@example.com', 'hashed_password_here', 'Admin User', 'admin'),
('user', 'user@example.com', 'hashed_password_here', 'Regular User', 'user'),
('testuser', 'test@example.com', 'testpassword', 'Test User', 'user');

-- Insert sample data for products
INSERT OR IGNORE INTO products (name, price, description, category_id) VALUES 
('Laptop', 999.99, 'High-performance laptop', 1),
('Mouse', 29.99, 'Wireless mouse', 2),
('Keyboard', 79.99, 'Mechanical keyboard', 2),
('Monitor', 299.99, 'LED monitor', 1);

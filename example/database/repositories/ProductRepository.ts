import { CrudRepository } from '../../../src/database/repositories/CrudRepository';
import { DatabaseProvider } from '../../../src/database/interfaces/DatabaseProvider';
import { ErrorHandler } from '../../../src/utils/errorHandler';
import { Repository } from '../../../src/core/AutoRegistration';
import { Product } from '../../models/Product';

/**
 * Product Repository with @Repository decorator
 * Auto-registered as singleton repository
 */
@Repository('ProductRepository') // ← Auto-registration as autonomous repository
export class ProductRepository extends CrudRepository<Product> {
    constructor(provider: DatabaseProvider, errorHandler: ErrorHandler) {
        super(provider, {
            tableName: 'products',
            primaryKey: 'id'
        }, errorHandler);
    }

    /**
     * Find products by category
     */
    async findByCategory(categoryId: number): Promise<Product[]> {
        return this.findBy('category_id', categoryId);
    }

    /**
     * Find products in price range
     */
    async findByPriceRange(minPrice: number, maxPrice: number): Promise<Product[]> {
        const sql = `
            SELECT * FROM ${this.tableName} 
            WHERE price BETWEEN ? AND ?
            ORDER BY price ASC
        `;
        const results = await this.provider.query(sql, [minPrice, maxPrice]);
        return results as Product[];
    }

    /**
     * Search products by name or description
     */
    async searchProducts(searchTerm: string): Promise<Product[]> {
        const sql = `
            SELECT * FROM ${this.tableName} 
            WHERE name LIKE ? OR description LIKE ?
            ORDER BY name ASC
        `;
        const term = `%${searchTerm}%`;
        const results = await this.provider.query(sql, [term, term]);
        return results as Product[];
    }

    /**
     * Get expensive products (above threshold)
     */
    async findExpensiveProducts(threshold: number = 100): Promise<Product[]> {
        const sql = `
            SELECT * FROM ${this.tableName} 
            WHERE price > ?
            ORDER BY price DESC
        `;
        const results = await this.provider.query(sql, [threshold]);
        return results as Product[];
    }

    /**
     * Update product price
     */
    async updatePrice(id: number, newPrice: number): Promise<Product | null> {
        return this.updateById(id, { 
            price: newPrice,
            updated_at: new Date().toISOString()
        });
    }

    /**
     * Get products count by category
     */
    async countByCategory(): Promise<Array<{category_id: number, count: number}>> {
        const sql = `
            SELECT category_id, COUNT(*) as count
            FROM ${this.tableName}
            WHERE category_id IS NOT NULL
            GROUP BY category_id
            ORDER BY count DESC
        `;
        const results = await this.provider.query(sql);
        return results as Array<{category_id: number, count: number}>;
    }
}

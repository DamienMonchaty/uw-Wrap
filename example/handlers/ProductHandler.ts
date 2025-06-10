import { Route, GET, POST, PUT, DELETE, Auth, Validate } from '../../src/core/RouteDecorators';
import { HttpHandler } from '../../src/core/HttpHandler';
import { UWebSocketWrapper } from '../../src/core/ServerWrapper';
import { Logger } from '../../src/utils/logger';
import { ErrorHandler } from '../../src/utils/errorHandler';
import { Controller } from '../../src/core/AutoRegistration';
import { ProductRepository } from '../database/repositories/ProductRepository';
import { AppRepositoryManager } from '../database/AppRepositoryManager';

// Validation schema for product creation
const CreateProductEntitySchema = {
    type: 'object',
    required: ['name', 'price'],
    properties: {
        name: { type: 'string', minLength: 2, maxLength: 100 },
        price: { type: 'number', minimum: 0 },
        description: { type: 'string', maxLength: 500 },
        category_id: { type: 'number', minimum: 1 }
    }
};

/**
 * Product Entity Handler - Using direct repository injection  
 * Shows how to use auto-registered repositories directly
 */
@Controller('ProductHandler') // ← Auto-registered controller
@Route('/products')
export class ProductHandler extends HttpHandler {
    private repositories: AppRepositoryManager;
    
    constructor(
        server: UWebSocketWrapper,
        logger: Logger,
        errorHandler: ErrorHandler,
        repositories: AppRepositoryManager // ← Repository injection (registered as 'ProductRepository')
    ) {
        super(server, logger, errorHandler);
        this.repositories = repositories;
    }
    
    @GET('/')
    async getAllProducts(req: any, res: any) {
        const products = await this.repositories.products.findAll();
        
        return { 
            success: true, 
            data: { products, total: products.length } 
        };
    }
    
    @GET('/:id')
    async getProduct(req: any, res: any) {
        const { id } = this.getPathParams(req);
        const parsedId = parseInt(id);
        
        if (!id || isNaN(parsedId)) {
            this.createValidationError('Invalid product ID', 'id');
        }
        
        const product = await this.repositories.products.findById(parsedId);
        
        if (!product) {
            this.createNotFoundError('Product', id);
        }
        
        return { success: true, data: { product } };
    }
    
    @POST('/')
    @Validate(CreateProductEntitySchema)
    @Auth(['admin', 'moderator'])
    async createProduct(req: any, res: any) {
        const productData = this.getRequestBody(req, res);
        
        const product = await this.repositories.products.create({
            ...productData,
            created_at: new Date().toISOString()
        });
        
        this.logger.info(`Product entity created: ${product.id} - ${product.name}`);
        
        return { 
            success: true, 
            data: { product },
            message: 'Product created successfully'
        };
    }
    
    @PUT('/:id')
    @Auth(['admin', 'moderator'])
    async updateProduct(req: any, res: any) {
        const { id } = this.getPathParams(req);
        const parsedId = parseInt(id);
        const updateData = this.getRequestBody(req, res);
        
        if (!id || isNaN(parsedId)) {
            this.createValidationError('Invalid product ID', 'id');
        }
        
        const product = await this.repositories.products.updateById(parsedId, {
            ...updateData,
            updated_at: new Date().toISOString()
        });
        
        if (!product) {
            this.createNotFoundError('Product', id);
        }
        
        this.logger.info(`Product entity updated: ${id}`);
        
        return { 
            success: true, 
            data: { product },
            message: 'Product updated successfully'
        };
    }
    
    @DELETE('/:id')
    @Auth(['admin'])
    async deleteProduct(req: any, res: any) {
        const { id } = this.getPathParams(req);
        const parsedId = parseInt(id);
        
        if (!id || isNaN(parsedId)) {
            this.createValidationError('Invalid product ID', 'id');
        }
        
        const deleted = await this.repositories.products.deleteById(parsedId);
        
        if (!deleted) {
            this.createNotFoundError('Product', id);
        }
        
        this.logger.info(`Product entity deleted: ${id}`);
        
        return { 
            success: true, 
            message: 'Product deleted successfully' 
        };
    }
    
    @GET('/search/:term')
    async searchProducts(req: any, res: any) {
        const { term } = this.getPathParams(req);
        
        if (!term || term.length < 2) {
            this.createValidationError('Search term must be at least 2 characters', 'term');
        }
        
        const products = await this.repositories.products.searchProducts(term);
        
        return { 
            success: true, 
            data: { products, total: products.length },
            searchTerm: term
        };
    }
    
    @GET('/price-range/:min/:max')
    async getProductsByPriceRange(req: any, res: any) {
        const { min, max } = this.getPathParams(req);
        const minPrice = parseFloat(min);
        const maxPrice = parseFloat(max);
        
        if (!min || !max || isNaN(minPrice) || isNaN(maxPrice) || minPrice < 0 || maxPrice < minPrice) {
            this.createValidationError('Invalid price range', 'price_range');
        }
        
        const products = await this.repositories.products.findByPriceRange(minPrice, maxPrice);
        
        return { 
            success: true, 
            data: { products, total: products.length },
            priceRange: { min: minPrice, max: maxPrice }
        };
    }
    
    @GET('/expensive/:threshold?')
    async getExpensiveProducts(req: any, res: any) {
        const { threshold } = this.getPathParams(req);
        const thresholdValue = parseFloat(threshold || '100');
        
        if (isNaN(thresholdValue) || thresholdValue < 0) {
            this.createValidationError('Invalid threshold value', 'threshold');
        }
        
        const products = await this.repositories.products.findExpensiveProducts(thresholdValue);
        
        return { 
            success: true, 
            data: { products, total: products.length },
            threshold: thresholdValue
        };
    }

    /**
     * Register routes for this handler (required by BaseHandler)
     */
    registerRoutes(): void {
        this.logger.info('ProductEntityHandler routes are automatically registered via decorators');
    }
}

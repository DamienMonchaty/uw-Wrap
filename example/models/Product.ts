/**
 * Product model for repository
 */
export interface Product {
    id?: number;
    name: string;
    price: number;
    description?: string;
    category_id?: number;
    created_at?: string;
    updated_at?: string;
}
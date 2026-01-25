import { Product } from "../../domain/entities/product.entity";
import { ProductType } from "../../domain/value-objects/product-type.vo";

export interface ProductListFilters {
  type?: ProductType;       // subscription | one_off | addon
  isActive?: boolean;
  namePrefix?: string;      // optional prefix search
}

export interface Pagination {
  pageNumber: number;       // 1-based
  pageSize: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;            // total items matching filter
  pageNumber: number;
  pageSize: number;
}

export interface ProductRepository {
  create(product: Product): Promise<void>;

  update(product: Product): Promise<void>;

  delete(productId: string): Promise<void>;

  findById(productId: string): Promise<Product | null>;

  list(
    filters: ProductListFilters,
    pagination: Pagination
  ): Promise<PaginatedResult<Product>>;
}

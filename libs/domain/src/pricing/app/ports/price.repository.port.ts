import { Price } from "../../domain/entities/price.entity";

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

export interface PriceRepository {
  create(price: Price): Promise<void>;

  update(price: Price): Promise<void>;

  delete(priceId: string): Promise<void>;

  findById(priceId: string): Promise<Price | null>;

  findByProductId(
    productId: string,
    pagination: Pagination
  ): Promise<PaginatedResult<Price>>;
}

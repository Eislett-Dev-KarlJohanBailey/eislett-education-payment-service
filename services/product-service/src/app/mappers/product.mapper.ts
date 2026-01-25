import { Product } from "../../domain/entities/product.entity";

export class ProductResponseMapper {
  static toDto(product: Product): any {
    return {
      productId: product.productId,
      name: product.name,
      description: product.description,
      type: product.type,
      entitlements: product.entitlements,
      usageLimits: product.usageLimits,
      addons: product.addons,
      providers: product.providers,
      isActive: product.isActive,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt
    };
  }

  static toDtoList(products: Product[]): any[] {
    return products.map(this.toDto);
  }
}

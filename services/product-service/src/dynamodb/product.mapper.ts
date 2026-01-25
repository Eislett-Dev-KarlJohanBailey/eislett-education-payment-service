import { Product } from "../domain/entities/product.entity";
import { ProductType } from "../domain/value-objects/product-type.vo";

export class ProductMapper {
  static toItem(product: Product): any {
    return {
      PK: `PRODUCT#${product.productId}`,
      SK: "METADATA",

      GSI1PK: `TYPE#${product.type}`,
      GSI1SK: `CREATED#${product.createdAt.toISOString()}`,

      productId: product.productId,
      name: product.name,
      nameLower: product.name.toLowerCase(),
      description: product.description,
      type: product.type,
      entitlements: product.entitlements,
      usageLimits: product.usageLimits,
      addons: product.addons,
      isActive: product.isActive,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString()
    };
  }

  static toDomain(item: any): Product {
    return Product.create({
      productId: item.productId,
      name: item.name,
      description: item.description,
      type: item.type as ProductType,
      entitlements: item.entitlements,
      usageLimits: item.usageLimits,
      addons: item.addons,
      isActive: item.isActive
    });
  }
}

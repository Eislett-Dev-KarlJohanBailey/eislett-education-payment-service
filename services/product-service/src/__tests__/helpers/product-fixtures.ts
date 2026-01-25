import { Product } from '../../domain/entities/product.entity';
import { ProductType } from '../../domain/value-objects/product-type.vo';

export class ProductFixtures {
  static createProduct(overrides: Partial<{
    productId: string;
    name: string;
    description: string;
    type: ProductType;
    entitlements: string[];
    providers: Record<string, string>;
    isActive: boolean;
  }> = {}): Product {
    return Product.create({
      productId: overrides.productId || 'prod-123',
      name: overrides.name || 'Test Product',
      description: overrides.description || 'Test Description',
      type: overrides.type || ProductType.SUBSCRIPTION,
      entitlements: overrides.entitlements || ['test-entitlement'],
      providers: overrides.providers,
      isActive: overrides.isActive !== undefined ? overrides.isActive : true,
    });
  }

  static createProductItem(overrides: any = {}): any {
    return {
      PK: `PRODUCT#${overrides.productId || 'prod-123'}`,
      SK: 'METADATA',
      GSI1PK: `TYPE#${overrides.type || ProductType.SUBSCRIPTION}`,
      GSI1SK: `CREATED#${new Date().toISOString()}`,
      productId: overrides.productId || 'prod-123',
      name: overrides.name || 'Test Product',
      nameLower: (overrides.name || 'Test Product').toLowerCase(),
      description: overrides.description || 'Test Description',
      type: overrides.type || ProductType.SUBSCRIPTION,
      entitlements: overrides.entitlements || ['test-entitlement'],
      usageLimits: overrides.usageLimits || [],
      addons: overrides.addons || [],
      providers: overrides.providers || {},
      isActive: overrides.isActive !== undefined ? overrides.isActive : true,
      createdAt: overrides.createdAt || new Date().toISOString(),
      updatedAt: overrides.updatedAt || new Date().toISOString(),
    };
  }

  static createProductList(count: number = 3): any[] {
    return Array.from({ length: count }, (_, i) =>
      this.createProductItem({
        productId: `prod-${i + 1}`,
        name: `Product ${i + 1}`,
      })
    );
  }
}

import { ProductRepository } from "../ports/product.repository.port";
import { NotFoundError } from "../../domain/errors/not-found.error";
import { ProductType } from "../../domain/value-objects/product-type.vo";

export class FindProductByEntitlementKeyUseCase {
  constructor(
    private readonly repo: ProductRepository
  ) {}

  async execute(entitlementKey: string) {
    // Search all product types (repo defaults to subscription only when type is omitted)
    const types: ProductType[] = [
      ProductType.SUBSCRIPTION,
      ProductType.ONE_OFF,
      ProductType.ADDON
    ];
    const pageSize = 100;
    let pageNumber = 1;

    for (const productType of types) {
      let hasMore = true;
      while (hasMore) {
        const result = await this.repo.list(
          { isActive: true, type: productType },
          { pageNumber, pageSize }
        );

        // Match products that contain this entitlement key (not necessarily exactly one)
        const matchingProduct = result.items.find(product =>
          product.entitlements.some(e => e === entitlementKey)
        );

        if (matchingProduct) {
          return {
            productId: matchingProduct.productId,
            name: matchingProduct.name,
            description: matchingProduct.description,
            type: matchingProduct.type,
            entitlements: matchingProduct.entitlements,
            usageLimits: matchingProduct.usageLimits,
            addons: matchingProduct.addons,
            addonConfigs: matchingProduct.addonConfigs,
            providers: matchingProduct.providers,
            isActive: matchingProduct.isActive,
            createdAt: matchingProduct.createdAt,
            updatedAt: matchingProduct.updatedAt
          };
        }

        hasMore = result.items.length === pageSize;
        pageNumber++;
      }
      pageNumber = 1;
    }

    throw new NotFoundError(`No product found with entitlement key '${entitlementKey}'`);
  }
}

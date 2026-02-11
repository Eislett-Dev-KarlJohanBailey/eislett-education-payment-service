import { ProductRepository } from "../ports/product.repository.port";
import { NotFoundError } from "../../domain/errors/not-found.error";

export class FindProductByEntitlementKeyUseCase {
  constructor(
    private readonly repo: ProductRepository
  ) {}

  async execute(entitlementKey: string) {
    // Search through all active products to find one with ONLY the specified entitlement key
    const pageSize = 100; // Large page size to minimize queries
    let pageNumber = 1;
    let hasMore = true;

    while (hasMore) {
      const result = await this.repo.list(
        {
          isActive: true, // Only search active products
        },
        {
          pageNumber,
          pageSize,
        }
      );

      // Filter for products that have exactly one entitlement key matching the requested key
      const matchingProduct = result.items.find(product => {
        const entitlements = product.entitlements;
        return entitlements.length === 1 && entitlements[0] === entitlementKey;
      });

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

      // Check if there are more pages
      hasMore = result.items.length === pageSize;
      pageNumber++;
    }

    throw new NotFoundError(`No product found with entitlement key '${entitlementKey}'`);
  }
}

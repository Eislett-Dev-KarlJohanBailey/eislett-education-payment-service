import { ProductRepository } from "../ports/product.repository.port";
import { ProductType } from "../../domain/value-objects/product-type.vo";

export class ListProductsUseCase {
  constructor(
    private readonly repo: ProductRepository
  ) {}

  async execute(input: {
    pageNumber: number;
    pageSize: number;
    type?: ProductType;
    isActive?: boolean;
    entitlementKey?: string;
  }) {
    // Normalize entitlement_key: kebab-case in URL -> snake_case (e.g. ai-tutor-access -> ai_tutor_access)
    const entitlementKey = input.entitlementKey
      ? input.entitlementKey.replace(/-/g, "_")
      : undefined;

    // When filtering by entitlement_key without type, search all types and merge into one page
    if (entitlementKey && input.type === undefined) {
      const types: ProductType[] = [
        ProductType.SUBSCRIPTION,
        ProductType.ONE_OFF,
        ProductType.ADDON
      ];
      const results = await Promise.all(
        types.map(t =>
          this.repo.list(
            { type: t, isActive: input.isActive, entitlementKey },
            { pageNumber: input.pageNumber, pageSize: input.pageSize }
          )
        )
      );
      const merged = results.flatMap(r => r.items);
      const start = (input.pageNumber - 1) * input.pageSize;
      return {
        items: merged.slice(start, start + input.pageSize),
        total: merged.length,
        pageNumber: input.pageNumber,
        pageSize: input.pageSize
      };
    }

    return this.repo.list(
      {
        type: input.type,
        isActive: input.isActive,
        entitlementKey
      },
      {
        pageNumber: input.pageNumber,
        pageSize: input.pageSize
      }
    );
  }
}

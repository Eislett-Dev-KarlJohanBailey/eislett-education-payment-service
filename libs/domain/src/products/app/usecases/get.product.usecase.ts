import { ProductRepository } from "../ports/product.repository.port";
import { NotFoundError } from "../../domain/errors/not-found.error";

export class GetProductUseCase {
  constructor(
    private readonly repo: ProductRepository
  ) {}

  async execute(productId: string) {
    const product = await this.repo.findById(productId);

    if (!product) {
      throw new NotFoundError("Product not found");
    }

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
}

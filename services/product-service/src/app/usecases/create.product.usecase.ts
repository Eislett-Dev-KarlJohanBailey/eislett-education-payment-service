import { ProductRepository } from "../ports/product.repository.port";
import { Product } from "../../domain/entities/product.entity";
import { ProductType } from "../../domain/value-objects/product-type.vo";
import { randomUUID } from "crypto";

export class CreateProductUseCase {
  constructor(
    private readonly repo: ProductRepository
  ) {}

  async execute(input: any) {
    const product = Product.create({
      productId: randomUUID(),
      name: input.name,
      description: input.description,
      type: input.type as ProductType,
      entitlements: input.entitlements,
      usageLimits: input.usageLimits,
      addons: input.addons,
      isActive: true
    });

    await this.repo.create(product);

    return {
      productId: product.productId
    };
  }
}

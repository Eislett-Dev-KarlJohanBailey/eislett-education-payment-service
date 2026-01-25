import { ProductRepository } from "../ports/product.repository.port";
import { NotFoundError } from "../../domain/errors/not-found.error";

export class DeleteProductUseCase {
  constructor(
    private readonly repo: ProductRepository
  ) {}

  async execute(productId: string) {
    const product = await this.repo.findById(productId);

    if (!product) {
      throw new NotFoundError("Product not found");
    }

    await this.repo.delete(productId);

    return {
      deleted: true,
      productId
    };
  }
}

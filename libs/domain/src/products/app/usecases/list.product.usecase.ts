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
  }) {
    return this.repo.list(
      {
        type: input.type,
        isActive: input.isActive
      },
      {
        pageNumber: input.pageNumber,
        pageSize: input.pageSize
      }
    );
  }
}

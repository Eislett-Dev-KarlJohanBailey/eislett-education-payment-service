import { PriceRepository } from "../ports/price.repository.port";

export class ListPricesByProductUseCase {
  constructor(
    private readonly repo: PriceRepository
  ) {}

  async execute(input: {
    productId: string;
    pageNumber: number;
    pageSize: number;
  }) {
    return this.repo.findByProductId(
      input.productId,
      {
        pageNumber: input.pageNumber,
        pageSize: input.pageSize
      }
    );
  }
}

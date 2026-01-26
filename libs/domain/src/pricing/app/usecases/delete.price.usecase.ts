import { PriceRepository } from "../ports/price.repository.port";
import { NotFoundError } from "../../domain/errors/not-found.error";

export class DeletePriceUseCase {
  constructor(
    private readonly repo: PriceRepository
  ) {}

  async execute(priceId: string) {
    const price = await this.repo.findById(priceId);

    if (!price) {
      throw new NotFoundError("Price not found");
    }

    await this.repo.delete(priceId);

    return {
      deleted: true,
      priceId
    };
  }
}

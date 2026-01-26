import { PriceRepository } from "../ports/price.repository.port";
import { NotFoundError } from "../../domain/errors/not-found.error";

export class GetPriceUseCase {
  constructor(
    private readonly repo: PriceRepository
  ) {}

  async execute(priceId: string) {
    const price = await this.repo.findById(priceId);

    if (!price) {
      throw new NotFoundError("Price not found");
    }

    return {
      priceId: price.priceId,
      productId: price.productId,
      billingType: price.billingType,
      interval: price.interval,
      frequency: price.frequency,
      amount: price.amount,
      currency: price.currency,
      providers: price.providers,
      createdAt: price.createdAt,
      updatedAt: price.updatedAt
    };
  }
}

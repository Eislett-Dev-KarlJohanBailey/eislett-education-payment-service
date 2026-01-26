import { PriceRepository } from "../ports/price.repository.port";
import { NotFoundError } from "../../domain/errors/not-found.error";
import { Interval } from "../../domain/value-objects/interval.vo";

export class UpdatePriceUseCase {
  constructor(
    private readonly repo: PriceRepository
  ) {}

  async execute(priceId: string, input: any) {
    const price = await this.repo.findById(priceId);

    if (!price) {
      throw new NotFoundError("Price not found");
    }

    if ("amount" in input && input.amount !== undefined) {
      price.updateAmount(input.amount);
    }

    if (input.currency) {
      price.updateCurrency(input.currency);
    }

    if (input.interval) {
      price.updateInterval(input.interval as Interval);
    }

    if ("frequency" in input && input.frequency !== undefined) {
      price.updateFrequency(input.frequency);
    }

    if (input.providers && typeof input.providers === 'object') {
      price.updateProviders(input.providers);
    }

    await this.repo.update(price);

    return {
      updated: true,
      priceId: price.priceId
    };
  }
}

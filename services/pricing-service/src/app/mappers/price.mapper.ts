import { Price } from "../../domain/entities/price.entity";

export class PriceResponseMapper {
  static toDto(price: Price): any {
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

  static toDtoList(prices: Price[]): any[] {
    return prices.map(this.toDto);
  }
}

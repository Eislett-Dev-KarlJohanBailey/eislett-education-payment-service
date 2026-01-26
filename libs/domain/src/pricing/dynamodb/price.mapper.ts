import { Price } from "../domain/entities/price.entity";
import { BillingType } from "../domain/value-objects/billing-type.vo";
import { Interval } from "../domain/value-objects/interval.vo";

export class PriceMapper {
  static toItem(price: Price): any {
    return {
      PK: `PRICE#${price.priceId}`,
      SK: "METADATA",

      GSI1PK: `PRODUCT#${price.productId}`,
      GSI1SK: `CREATED#${price.createdAt.toISOString()}`,

      priceId: price.priceId,
      productId: price.productId,
      billingType: price.billingType,
      interval: price.interval,
      frequency: price.frequency,
      amount: price.amount,
      currency: price.currency,
      providers: price.providers,
      createdAt: price.createdAt.toISOString(),
      updatedAt: price.updatedAt.toISOString()
    };
  }

  static toDomain(item: any): Price {
    return Price.create({
      priceId: item.priceId,
      productId: item.productId,
      billingType: item.billingType as BillingType,
      interval: item.interval as Interval | undefined,
      frequency: item.frequency,
      amount: item.amount,
      currency: item.currency,
      providers: item.providers
    });
  }
}

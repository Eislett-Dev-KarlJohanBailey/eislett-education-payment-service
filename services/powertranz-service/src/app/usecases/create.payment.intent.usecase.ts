import {
  GetPriceUseCase,
  GetProductUseCase,
  BillingType,
  ProductType,
} from "@libs/domain";
import { PowerTranzClient } from "../../infrastructure/powertranz.client";
import {
  PowerTranzIntentRepository,
  PowerTranzPaymentIntent,
} from "../../infrastructure/powertranz.intent.repository";
import { randomUUID } from "crypto";

export interface CreatePowerTranzPaymentIntentInput {
  userId: string;
  priceId: string;
}

export interface CreatePowerTranzPaymentIntentOutput {
  hppHtml?: string;
  redirectData?: unknown;
  expiresAt: string;
  amount: number;
  currency: string;
  priceId: string;
  productId: string;
}

export class CreatePaymentIntentUseCase {
  constructor(
    private readonly getPriceUseCase: GetPriceUseCase,
    private readonly getProductUseCase: GetProductUseCase,
    private readonly powerTranzClient: PowerTranzClient,
    private readonly paymentIntentRepo: PowerTranzIntentRepository,
  ) {}

  async execute(
    input: CreatePowerTranzPaymentIntentInput,
  ): Promise<CreatePowerTranzPaymentIntentOutput> {
    const price = await this.getPriceUseCase.execute(input.priceId);
    const product = await this.getProductUseCase.execute(price.productId);

    if (!["USD", "TTD"].includes(price.currency.toUpperCase())) {
      throw new Error("Invalid currency");
    }

    if (price.billingType !== BillingType.ONE_TIME) {
      throw new Error("Only one time paymnents are supported for now");
    }

    if (product.type !== ProductType.ONE_OFF) {
      throw new Error("Must be a one time purchase product");
    }

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const auth = await this.powerTranzClient.createSpiToken({
      Amount: price.amount,
      CurrencyCode: price.currency,
      CustomerReference: input.userId,
      ProductReference: input.priceId,
      ProductName: product.name,
    });

    const intent: PowerTranzPaymentIntent = {
      id: randomUUID(),
      userId: input.userId,
      priceId: input.priceId,
      productId: price.productId,
      spiToken: auth.spiToken,
      amount: price.amount,
      currency: price.currency,
      status: "pending_payment",
      expiresAt: expiresAt.toISOString(),
      createdAt: new Date().toISOString(),
    };

    await this.intentRepo.save(intent);

    return {
      hppHtml: auth.hppHtml,
      redirectData: auth.redirectData,
      expiresAt: expiresAt.toISOString(),
      amount: price.amount,
      currency: price.currency,
      priceId: input.priceId,
      productId: price.productId,
    };
  }
}

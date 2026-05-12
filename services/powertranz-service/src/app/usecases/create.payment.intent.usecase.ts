import {
  GetPriceUseCase,
  GetProductUseCase,
  BillingType,
  ProductType,
} from "@libs/domain";

export interface CreatePowerTranzPaymentIntentInput {
  userId: string;
  priceId: string;
}

export interface CreatePowerTranzPaymentIntentOutput {
  hppUrl: string;
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
    private readonly powerTranzClient: any, // replace with actual PowerTranz client type when instructure is implemented
    private readonly paymentIntentRepo: any, // replace with actual repository type ^
  ) {}

  async execute(
    input: CreatePaymentIntentUseCaseInput,
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

    const spiToken = await this.powerTranzClient.createSpiToken();
    const expiresAt = this.makeExpiryDate();

    const hpp = await this.powerTranzClient.createHpp({
      spiToken,
      amount: price.amount,
      currency: price.currency,
      productName: product.name,
      userId: input.userId,
      priceId: input.priceId,
      productId: price.productId,
    });

    await this.paymentIntentRepo.save({
      userId: input.userId,
      priceId: input.priceId,
      productId: product.productId,
      spiToken,
      status: "pending_payment",
      expiresAt,
      createdAt: new Date(),
    });

    return {
      hppUrl: hpp.url,
      expiresAt: expiresAt.toISOString(),
      amount: price.amount,
      currency: price.currency,
      priceId: input.priceId,
      productId: price.productId,
    };
  }

  private makeExpiryDate(): Date {
    const minutes = 10;
    return new Date(Date.now() + minutes * 60 * 1000);
  }
}

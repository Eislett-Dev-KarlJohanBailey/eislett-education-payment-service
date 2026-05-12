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
  spiToken: string;
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
  }
}

import {
  GetPriceUseCase,
  GetProductUseCase,
  BillingType,
  ProductType,
} from "@libs/domain";
import config from "../../config";
import { PowerTranzClient } from "../../infrastructure/powertranz.client";
import {
  PowerTranzIntentRepository,
  PowerTranzPaymentIntent,
} from "../../infrastructure/powertranz.intent.repository";
import { randomUUID } from "crypto";
import { BadRequestError } from "../errors/bad-request.error";

const POWERTRANZ_CURRENCY = "TTD";
const POWERTRANZ_CURRENCY_CODE = "780";

export interface CreatePowerTranzPaymentIntentInput {
  userId: string;
  userEmail?: string;
  priceId: string;
}

export interface CreatePowerTranzPaymentIntentOutput {
  redirectData?: unknown;
  hostedPaymentPageHtml?: string;
  spiToken: string;
  transactionIdentifier?: string;
  orderIdentifier?: string;
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

  private merchantResponseUrl(): string {
    const baseUrl = config.powertranz.merchantResponseUrl.trim();
    if (!baseUrl) {
      throw new Error("POWERTRANZ_MERCHANT_RESPONSE_URL is not configured");
    }

    if (!config.powertranz.callbackSecret) {
      return baseUrl;
    }

    const url = new URL(baseUrl);
    url.searchParams.set("secret", config.powertranz.callbackSecret);
    return url.toString();
  }

  private hostedPagePageSet(): string | undefined {
    const pageSet = config.powertranz.hostedPagePageSet.trim();
    if (!pageSet) {
      return undefined;
    }

    return pageSet.startsWith("PTZ/") ? pageSet : `PTZ/${pageSet}`;
  }

  async execute(
    input: CreatePowerTranzPaymentIntentInput,
  ): Promise<CreatePowerTranzPaymentIntentOutput> {
    const price = await this.getPriceUseCase.execute(input.priceId);
    const product = await this.getProductUseCase.execute(price.productId);

    if (price.billingType !== BillingType.ONE_TIME) {
      throw new BadRequestError("Only one time payments are supported for now");
    }

    if (product.type !== ProductType.ONE_OFF) {
      throw new BadRequestError("Must be a one time purchase product");
    }

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const transactionIdentifier = randomUUID();
    const orderIdentifier = transactionIdentifier;
    const pageSet = this.hostedPagePageSet();

    const sale = await this.powerTranzClient.createAuthSpiToken({
      TransactionIdentifier: transactionIdentifier,
      TotalAmount: price.amount,
      CurrencyCode: POWERTRANZ_CURRENCY_CODE,
      ThreeDSecure: true,
      OrderIdentifier: orderIdentifier,
      AddressMatch: false,
      ExtendedData: {
        ThreeDSecure: {
          ChallengeWindowSize: 4,
          ChallengeIndicator: "01",
        },
        MerchantResponseUrl: this.merchantResponseUrl(),
        HostedPage: {
          ...(pageSet ? { PageSet: pageSet } : {}),
          ...(config.powertranz.hostedPagePageName
            ? { PageName: config.powertranz.hostedPagePageName }
            : {}),
        },
      },
    });

    const intent: PowerTranzPaymentIntent = {
      id: randomUUID(),
      userId: input.userId,
      userEmail: input.userEmail,
      priceId: input.priceId,
      productId: price.productId,
      spiToken: sale.spiToken,
      amount: price.amount,
      currency: POWERTRANZ_CURRENCY,
      status: "pending_payment",
      expiresAt: expiresAt.toISOString(),
      createdAt: new Date().toISOString(),
      transactionId: sale.transactionIdentifier || transactionIdentifier,
      orderIdentifier: sale.orderIdentifier || orderIdentifier,
    };

    await this.paymentIntentRepo.save(intent);

    return {
      redirectData: sale.redirectData,
      hostedPaymentPageHtml: sale.hostedPaymentPageHtml,
      spiToken: sale.spiToken,
      transactionIdentifier: intent.transactionId,
      orderIdentifier: intent.orderIdentifier,
      expiresAt: expiresAt.toISOString(),
      amount: price.amount,
      currency: POWERTRANZ_CURRENCY,
      priceId: input.priceId,
      productId: price.productId,
    };
  }
}

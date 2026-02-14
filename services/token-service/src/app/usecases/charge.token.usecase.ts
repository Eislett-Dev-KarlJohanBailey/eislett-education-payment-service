import {
  EntitlementRepository,
  PriceRepository,
  ProductRepositoryPorts,
  BillingEvent,
  DomainError,
} from "@libs/domain";
import { BillingEventPublisher } from "../../infrastructure/event.publisher";

class NotFoundError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export interface ChargeTokenInput {
  userId: string;
  priceId: string;
}

export interface ChargeTokenOutput {
  success: boolean;
  paymentIntentId: string;
  amount: number;
  remainingTokens: number;
}

export class ChargeTokenUseCase {
  constructor(
    private readonly entitlementRepo: EntitlementRepository,
    private readonly priceRepo: PriceRepository,
    private readonly productRepo: ProductRepositoryPorts.ProductRepository,
    private readonly eventPublisher: BillingEventPublisher
  ) {}

  async execute(input: ChargeTokenInput): Promise<ChargeTokenOutput> {
    const { userId, priceId } = input;

    // Get price
    const price = await this.priceRepo.findById(priceId);
    if (!price) {
      throw new NotFoundError(`Price '${priceId}' not found`);
    }

    // Validate currency is "token"
    if (price.currency.toLowerCase() !== "token") {
      throw new DomainError(
        `Price '${priceId}' does not use token currency. Currency: ${price.currency}`
      );
    }

    // Get product
    const product = await this.productRepo.findById(price.productId);
    if (!product) {
      throw new NotFoundError(`Product '${price.productId}' not found`);
    }

    // Get user's token entitlement
    let entitlement = await this.entitlementRepo.findByUserAndKey(
      userId,
      "token"
    );

    if (!entitlement) {
      throw new NotFoundError(
        `Token entitlement not found for user '${userId}'`
      );
    }

    if (!entitlement.isActive()) {
      throw new DomainError(`Token entitlement is not active for user '${userId}'`);
    }

    if (!entitlement.usage) {
      throw new DomainError(`Token entitlement is not usage-based`);
    }

    // Lazy evaluation: reset usage if period has passed
    if (entitlement.usage.shouldReset()) {
      entitlement.usage.reset();
      await this.entitlementRepo.update(entitlement);
      // Re-fetch to ensure we have fresh usage
      const updated = await this.entitlementRepo.findByUserAndKey(userId, "token");
      if (!updated?.usage) {
        throw new DomainError(`Token entitlement is not usage-based`);
      }
      entitlement = updated;
    }

    // Ensure usage is still defined after potential reset
    if (!entitlement.usage) {
      throw new DomainError(`Token entitlement is not usage-based`);
    }

    // Check if user has enough tokens
    const requiredAmount = price.amount;
    const availableTokens = entitlement.usage.getEffectiveLimit() - entitlement.usage.used;

    if (availableTokens < requiredAmount) {
      const error = new DomainError(
        `Insufficient tokens. Required: ${requiredAmount}, Available: ${availableTokens}`
      );
      (error as any).code = "INSUFFICIENT_FUNDS";
      throw error;
    }

    // Decrement tokens by increasing used amount
    entitlement.usage.used += requiredAmount;
    await this.entitlementRepo.update(entitlement);

    // Generate payment intent ID (for idempotency tracking)
    const paymentIntentId = `token_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Publish payment.successful event
    const event: BillingEvent.PaymentSuccessfulEvent = {
      type: BillingEvent.PaymentEventType.PAYMENT_SUCCESSFUL,
      payload: {
        paymentIntentId,
        userId,
        amount: requiredAmount,
        currency: "token",
        priceId: price.priceId,
        productId: product.productId,
        billingType: price.billingType === "one_time" ? "one_time" : "recurring",
        provider: "token" as any, // Token is a custom provider
      },
      meta: this.eventPublisher.createMetadata("token-service"),
      version: 1,
    };

    await this.eventPublisher.publish(event);

    // Get final token balance
    const finalEntitlement = await this.entitlementRepo.findByUserAndKey(
      userId,
      "token"
    );
    const remainingTokens =
      finalEntitlement && finalEntitlement.usage
        ? finalEntitlement.usage.getEffectiveLimit() - finalEntitlement.usage.used
        : 0;

    return {
      success: true,
      paymentIntentId,
      amount: requiredAmount,
      remainingTokens,
    };
  }
}

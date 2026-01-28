import { StripeClient } from "../../infrastructure/stripe.client";
import { StripeCustomerRepository } from "../../infrastructure/stripe-customer.repository";
import { GetProductUseCase, GetPriceUseCase, UpdateProductUseCase, UpdatePriceUseCase, BillingType, Interval } from "@libs/domain";

export interface CreatePaymentIntentInput {
  userId: string;
  userRole?: string;
  userEmail?: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CreatePaymentIntentOutput {
  checkoutUrl?: string;
  paymentIntentId?: string;
  customerId: string;
  subscriptionId?: string;
  isUpdate: boolean;
}

export class CreatePaymentIntentUseCase {
  constructor(
    private readonly stripeClient: StripeClient,
    private readonly customerRepo: StripeCustomerRepository,
    private readonly getProductUseCase: GetProductUseCase,
    private readonly getPriceUseCase: GetPriceUseCase,
    private readonly updateProductUseCase: UpdateProductUseCase,
    private readonly updatePriceUseCase: UpdatePriceUseCase
  ) {}

  async execute(input: CreatePaymentIntentInput): Promise<CreatePaymentIntentOutput> {
    // Get or create Stripe customer
    let customer = await this.customerRepo.findByUserId(input.userId);
    let stripeCustomerId: string;

    if (!customer) {
      // Create Stripe customer
      const stripeCustomer = await this.stripeClient.createCustomer({
        email: input.userEmail,
        metadata: {
          userId: input.userId,
          role: input.userRole || "",
        },
      });

      // Store mapping
      await this.customerRepo.create({
        userId: input.userId,
        stripeCustomerId: stripeCustomer.id,
        role: input.userRole,
        email: input.userEmail,
      });

      stripeCustomerId = stripeCustomer.id;
    } else {
      stripeCustomerId = customer.stripeCustomerId;
    }

    // Get price
    const price = await this.getPriceUseCase.execute(input.priceId);
    
    // Get product
    const product = await this.getProductUseCase.execute(price.productId);

    // Check if Stripe IDs exist, create if not
    let stripeProductId = product.providers?.stripe;
    let stripePriceId = price.providers?.stripe;

    if (!stripeProductId) {
      // Create Stripe product
      const stripeProduct = await this.stripeClient.createProduct(
        product.name,
        product.description
      );
      stripeProductId = stripeProduct.id;

      // Update product with Stripe ID
      await this.updateProductUseCase.execute(product.productId, {
        providers: {
          ...product.providers,
          stripe: stripeProductId,
        },
      });
    }

    if (!stripePriceId) {
      // Create Stripe price
      const recurring = price.billingType === BillingType.RECURRING ? {
        interval: this.mapInterval(price.interval!),
        intervalCount: price.frequency,
      } : undefined;

      const stripePrice = await this.stripeClient.createPrice({
        productId: stripeProductId!,
        unitAmount: Math.round(price.amount * 100), // Convert to cents
        currency: price.currency,
        recurring,
      });
      stripePriceId = stripePrice.id;

      // Update price with Stripe ID
      await this.updatePriceUseCase.execute(price.priceId, {
        providers: {
          ...price.providers,
          stripe: stripePriceId,
        },
      });
    }

    // Check for existing active subscriptions
    // If user already has a subscription, update it instead of creating a new one
    const existingSubscriptions = await this.stripeClient.listCustomerSubscriptions(stripeCustomerId);
    
    if (existingSubscriptions.length > 0) {
      // User has an existing subscription - update it instead of creating a new one
      // This prevents double billing and automatically handles proration
      const existingSubscription = existingSubscriptions[0]; // Take the first active subscription
      
      console.log(`Updating existing subscription ${existingSubscription.id} for customer ${stripeCustomerId}`);
      
      // Get the old productId from the existing subscription metadata
      // This will be used by the webhook to remove entitlements from the old product
      const oldProductId = existingSubscription.metadata?.productId;
      
      // Update the subscription with the new price
      // Include previousProductId in metadata temporarily so webhook can use it
      // The webhook will handle removing old entitlements
      const updatedSubscription = await this.stripeClient.updateSubscription(
        existingSubscription.id,
        {
          priceId: stripePriceId!,
          metadata: {
            userId: input.userId,
            priceId: input.priceId,
            productId: product.productId,
            // Include old productId if it exists and is different
            ...(oldProductId && oldProductId !== product.productId ? { previousProductId: oldProductId } : {}),
          },
        }
      );

      return {
        customerId: stripeCustomerId,
        subscriptionId: updatedSubscription.id,
        isUpdate: true,
      };
    }

    // No existing subscription - create a new checkout session
    const session = await this.stripeClient.createCheckoutSession({
      customerId: stripeCustomerId,
      priceId: stripePriceId!,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
      metadata: {
        userId: input.userId,
        priceId: input.priceId,
        productId: product.productId,
      },
    });

    return {
      checkoutUrl: session.url || "",
      paymentIntentId: session.payment_intent as string | undefined,
      customerId: stripeCustomerId,
      isUpdate: false,
    };
  }

  private mapInterval(interval: Interval): "day" | "week" | "month" | "year" {
    switch (interval) {
      case Interval.DAY:
        return "day";
      case Interval.WEEK:
        return "week";
      case Interval.MONTH:
        return "month";
      case Interval.YEAR:
        return "year";
      default:
        return "month";
    }
  }
}

import Stripe from "stripe";
import { WebhookIdempotencyRepository } from "../../infrastructure/webhook-idempotency.repository";
import { BillingEventPublisher } from "../../infrastructure/event.publisher";
import { StripeCustomerRepository } from "../../infrastructure/stripe-customer.repository";
import { StripeClient } from "../../infrastructure/stripe.client";
import {
  BillingEvent,
  GetProductUseCase,
} from "@libs/domain";

export class HandleWebhookUseCase {
  constructor(
    private readonly idempotencyRepo: WebhookIdempotencyRepository,
    private readonly eventPublisher: BillingEventPublisher,
    private readonly customerRepo: StripeCustomerRepository,
    private readonly stripeClient: StripeClient,
    private readonly getProductUseCase: GetProductUseCase
  ) {}

  async execute(event: Stripe.Event): Promise<void> {
    // Check idempotency
    const isProcessed = await this.idempotencyRepo.isProcessed(event.id);
    if (isProcessed) {
      console.log(`Webhook event ${event.id} already processed, skipping`);
      return;
    }

    try {
      // Process event based on type
      switch (event.type) {
        case "payment_intent.succeeded":
          await this.handlePaymentSucceeded(event);
          break;
        case "payment_intent.payment_failed":
          await this.handlePaymentFailed(event);
          break;
        case "payment_intent.requires_action":
          await this.handlePaymentActionRequired(event);
          break;
        case "customer.subscription.created":
          await this.handleSubscriptionCreated(event);
          break;
        case "customer.subscription.updated":
          await this.handleSubscriptionUpdated(event);
          break;
        case "customer.subscription.deleted":
          await this.handleSubscriptionDeleted(event);
          break;
        default:
          console.log(`Unhandled webhook event type: ${event.type}`);
      }

      // Mark as processed
      await this.idempotencyRepo.markAsProcessed(event.id, "processed");
    } catch (error) {
      console.error(`Error processing webhook ${event.id}:`, error);
      await this.idempotencyRepo.markAsProcessed(event.id, "failed");
      throw error;
    }
  }

  private async handlePaymentSucceeded(event: Stripe.Event): Promise<void> {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const customer = await this.getCustomerFromPaymentIntent(paymentIntent);

    const billingEvent: BillingEvent.PaymentSuccessfulEvent = {
      type: BillingEvent.PaymentEventType.PAYMENT_SUCCESSFUL,
      payload: {
        paymentIntentId: paymentIntent.id,
        userId: customer.userId,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency.toUpperCase(),
        priceId: paymentIntent.metadata.priceId || "",
        productId: paymentIntent.metadata.productId,
        provider: "stripe",
      },
      meta: this.eventPublisher.createMetadata("stripe"),
      version: 1,
    };

    await this.eventPublisher.publish(billingEvent);
  }

  private async handlePaymentFailed(event: Stripe.Event): Promise<void> {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const customer = await this.getCustomerFromPaymentIntent(paymentIntent);

    const billingEvent: BillingEvent.PaymentFailedEvent = {
      type: BillingEvent.PaymentEventType.PAYMENT_FAILED,
      payload: {
        paymentIntentId: paymentIntent.id,
        userId: customer.userId,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency.toUpperCase(),
        priceId: paymentIntent.metadata.priceId || "",
        productId: paymentIntent.metadata.productId,
        provider: "stripe",
        failureCode: paymentIntent.last_payment_error?.code,
        failureReason: paymentIntent.last_payment_error?.message,
      },
      meta: this.eventPublisher.createMetadata("stripe"),
      version: 1,
    };

    await this.eventPublisher.publish(billingEvent);
  }

  private async handlePaymentActionRequired(event: Stripe.Event): Promise<void> {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const customer = await this.getCustomerFromPaymentIntent(paymentIntent);

    const billingEvent: BillingEvent.PaymentActionRequiredEvent = {
      type: BillingEvent.PaymentEventType.PAYMENT_ACTION_REQUIRED,
      payload: {
        paymentIntentId: paymentIntent.id,
        userId: customer.userId,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency.toUpperCase(),
        priceId: paymentIntent.metadata.priceId || "",
        productId: paymentIntent.metadata.productId,
        provider: "stripe",
      },
      meta: this.eventPublisher.createMetadata("stripe"),
      version: 1,
    };

    await this.eventPublisher.publish(billingEvent);
  }

  private async handleSubscriptionCreated(event: Stripe.Event): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription;
    const customer = await this.customerRepo.findByStripeCustomerId(subscription.customer as string);
    
    if (!customer) {
      throw new Error(`Customer not found for Stripe customer ID: ${subscription.customer}`);
    }

    // Resolve productId from metadata or fallback to Stripe product lookup
    const productId = await this.resolveProductId(subscription);

    const billingEvent: BillingEvent.SubscriptionCreatedEvent = {
      type: BillingEvent.SubscriptionEventType.SUBSCRIPTION_CREATED,
      payload: {
        subscriptionId: subscription.id,
        userId: customer.userId,
        productId,
        priceId: subscription.items.data[0]?.price.id || subscription.metadata.priceId || "",
        status: subscription.status as any,
        currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
      meta: this.eventPublisher.createMetadata("stripe"),
      version: 1,
    };

    await this.eventPublisher.publish(billingEvent);
  }

  private async handleSubscriptionUpdated(event: Stripe.Event): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription;
    const customer = await this.customerRepo.findByStripeCustomerId(subscription.customer as string);
    
    if (!customer) {
      throw new Error(`Customer not found for Stripe customer ID: ${subscription.customer}`);
    }

    // Resolve productId from metadata or fallback to Stripe product lookup
    const productId = await this.resolveProductId(subscription);

    const billingEvent: BillingEvent.SubscriptionUpdatedEvent = {
      type: BillingEvent.SubscriptionEventType.SUBSCRIPTION_UPDATED,
      payload: {
        subscriptionId: subscription.id,
        userId: customer.userId,
        productId,
        priceId: subscription.items.data[0]?.price.id || subscription.metadata.priceId || "",
        status: subscription.status as any,
        currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
      meta: this.eventPublisher.createMetadata("stripe"),
      version: 1,
    };

    await this.eventPublisher.publish(billingEvent);
  }

  private async handleSubscriptionDeleted(event: Stripe.Event): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription;
    const customer = await this.customerRepo.findByStripeCustomerId(subscription.customer as string);
    
    if (!customer) {
      throw new Error(`Customer not found for Stripe customer ID: ${subscription.customer}`);
    }

    // Determine if it's canceled or expired
    const isCanceled = subscription.cancel_at_period_end;
    const eventType = isCanceled 
      ? BillingEvent.SubscriptionEventType.SUBSCRIPTION_CANCELED
      : BillingEvent.SubscriptionEventType.SUBSCRIPTION_EXPIRED;

    // Resolve productId from metadata or fallback to Stripe product lookup
    const productId = await this.resolveProductId(subscription);

    const billingEvent = {
      type: eventType,
      payload: {
        subscriptionId: subscription.id,
        userId: customer.userId,
        productId,
        priceId: subscription.items.data[0]?.price.id || subscription.metadata.priceId || "",
        status: subscription.status as any,
        currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
      meta: this.eventPublisher.createMetadata("stripe"),
      version: 1,
    };

    await this.eventPublisher.publish(billingEvent as any);
  }

  private async getCustomerFromPaymentIntent(paymentIntent: Stripe.PaymentIntent): Promise<{ userId: string }> {
    if (paymentIntent.customer) {
      const customer = await this.customerRepo.findByStripeCustomerId(paymentIntent.customer as string);
      if (customer) {
        return { userId: customer.userId };
      }
    }

    // Fallback to metadata
    if (paymentIntent.metadata.userId) {
      return { userId: paymentIntent.metadata.userId };
    }

    throw new Error(`Could not determine userId from payment intent ${paymentIntent.id}`);
  }

  /**
   * Resolves the internal productId from subscription metadata or by looking up the Stripe product
   * 
   * Flow:
   * 1. First, try to get productId from subscription.metadata (set via subscription_data.metadata in checkout)
   * 2. If missing, retrieve the Stripe price from the subscription
   * 3. Get the Stripe product from the price
   * 4. Search for internal product where providers.stripe matches the Stripe product ID
   * 
   * @param subscription - Stripe subscription object
   * @returns Internal productId or empty string if not found
   */
  private async resolveProductId(subscription: Stripe.Subscription): Promise<string> {
    // Primary: Get from metadata (set during checkout session creation)
    if (subscription.metadata?.productId) {
      return subscription.metadata.productId;
    }

    // Fallback: Look up product by Stripe product ID
    try {
      const priceId = subscription.items.data[0]?.price.id;
      if (!priceId) {
        console.warn(`No price found in subscription ${subscription.id}, cannot resolve productId`);
        return "";
      }

      // Retrieve Stripe price to get the product ID
      const stripePrice = await this.stripeClient.retrievePrice(priceId);
      const stripeProductId = typeof stripePrice.product === "string" 
        ? stripePrice.product 
        : stripePrice.product?.id;

      if (!stripeProductId) {
        console.warn(`No product found in Stripe price ${priceId}, cannot resolve productId`);
        return "";
      }

      // Note: We would need a method to find products by provider.stripe value
      // For now, we log a warning. In a future enhancement, we could:
      // 1. Add a findByProvider method to ProductRepository
      // 2. Or use a GSI on providers.stripe
      // 3. Or scan/list products and filter by providers.stripe
      console.warn(
        `ProductId not found in subscription metadata for subscription ${subscription.id}. ` +
        `Stripe product ID: ${stripeProductId}. ` +
        `Consider adding subscription_data.metadata when creating checkout sessions.`
      );

      return "";
    } catch (error) {
      console.error(`Error resolving productId for subscription ${subscription.id}:`, error);
      return "";
    }
  }
}

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
      console.log(`Webhook event ${event.id} already processed, skipping`, this.getProductUseCase);
      return;
    }

    try {
      // Process event based on type
      switch (event.type) {
        case "checkout.session.completed":
          await this.handleCheckoutSessionCompleted(event);
          break;
        case "payment_intent.succeeded":
          await this.handlePaymentSucceeded(event);
          break;
        case "payment_intent.payment_failed":
          await this.handlePaymentFailed(event);
          break;
        case "payment_intent.requires_action":
          await this.handlePaymentActionRequired(event);
          break;
        case "invoice.payment_failed":
          await this.handleInvoicePaymentFailed(event);
          break;
        case "invoice.paid":
          await this.handleInvoicePaid(event);
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

  /**
   * Handles checkout.session.completed event
   * This is the primary event for one-time payments (mode: "payment")
   * For subscriptions, subscription.created is used instead
   */
  private async handleCheckoutSessionCompleted(event: Stripe.Event): Promise<void> {
    const session = event.data.object as Stripe.Checkout.Session;
    
    // Only handle one-time payments (mode: "payment")
    // Subscriptions are handled by subscription.created
    if (session.mode !== "payment") {
      console.log(`Skipping checkout.session.completed for mode: ${session.mode} (not a one-time payment)`);
      return;
    }

    const customer = await this.customerRepo.findByStripeCustomerId(session.customer as string);
    if (!customer) {
      throw new Error(`Customer not found for Stripe customer ID: ${session.customer}`);
    }

    // Get productId and priceId from metadata
    const productId = session.metadata?.productId;
    const priceId = session.metadata?.priceId || "";
    const billingType = session.metadata?.billingType || "one_time";

    if (!productId) {
      console.log(`Checkout session completed but no productId in metadata, skipping`);
      return;
    }

    const billingEvent: BillingEvent.PaymentSuccessfulEvent = {
      type: BillingEvent.PaymentEventType.PAYMENT_SUCCESSFUL,
      payload: {
        paymentIntentId: session.payment_intent as string || session.id,
        userId: customer.userId,
        amount: (session.amount_total || 0) / 100,
        currency: (session.currency || "usd").toUpperCase(),
        priceId,
        productId,
        billingType: billingType as "one_time" | "recurring",
        provider: "stripe",
      },
      meta: this.eventPublisher.createMetadata("stripe"),
      version: 1,
    };

    await this.eventPublisher.publish(billingEvent);
  }

  private async handlePaymentSucceeded(event: Stripe.Event): Promise<void> {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const customer = await this.getCustomerFromPaymentIntent(paymentIntent);

    // Determine billing type from metadata (defaults to one_time if no subscription)
    const billingType = paymentIntent.metadata?.billingType || "one_time";

    const billingEvent: BillingEvent.PaymentSuccessfulEvent = {
      type: BillingEvent.PaymentEventType.PAYMENT_SUCCESSFUL,
      payload: {
        paymentIntentId: paymentIntent.id,
        userId: customer.userId,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency.toUpperCase(),
        priceId: paymentIntent.metadata.priceId || "",
        productId: paymentIntent.metadata.productId,
        billingType: billingType as "one_time" | "recurring",
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

    // Generate portal URL for resolving billing issues
    const portalUrl = await this.generatePortalUrl(customer.stripeCustomerId);

    // Calculate expiresAt - payment intents typically expire after 24 hours
    const expiresAt = paymentIntent.canceled_at 
      ? new Date(paymentIntent.canceled_at * 1000).toISOString()
      : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours from now

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
        portalUrl,
        expiresAt,
      },
      meta: this.eventPublisher.createMetadata("stripe"),
      version: 1,
    };

    await this.eventPublisher.publish(billingEvent);
  }

  private async handlePaymentActionRequired(event: Stripe.Event): Promise<void> {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const customer = await this.getCustomerFromPaymentIntent(paymentIntent);

    // Generate portal URL for resolving billing issues
    const portalUrl = await this.generatePortalUrl(customer.stripeCustomerId);

    // Calculate expiresAt - payment intents typically expire after 24 hours
    const expiresAt = paymentIntent.canceled_at 
      ? new Date(paymentIntent.canceled_at * 1000).toISOString()
      : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours from now

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
        portalUrl,
        expiresAt,
      },
      meta: this.eventPublisher.createMetadata("stripe"),
      version: 1,
    };

    await this.eventPublisher.publish(billingEvent);
  }

  private async handleInvoicePaymentFailed(event: Stripe.Event): Promise<void> {
    const invoice = event.data.object as Stripe.Invoice;
    const customer = await this.customerRepo.findByStripeCustomerId(invoice.customer as string);
    
    if (!customer) {
      throw new Error(`Customer not found for Stripe customer ID: ${invoice.customer}`);
    }

    // Generate portal URL for resolving billing issues
    const portalUrl = await this.generatePortalUrl(customer.stripeCustomerId);

    // Calculate expiresAt - invoices typically have a due date
    const expiresAt = invoice.due_date 
      ? new Date(invoice.due_date * 1000).toISOString()
      : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours from now

    // Get subscription/product info from invoice
    const subscriptionId = invoice.subscription as string | undefined;
    let productId: string | undefined;
    let priceId: string | undefined;

    if (subscriptionId) {
      try {
        const subscription = await this.stripeClient.retrieveSubscription(subscriptionId);
        productId = await this.resolveProductId(subscription);
        priceId = subscription.items.data[0]?.price.id || subscription.metadata.priceId || "";
      } catch (error) {
        console.error(`Error retrieving subscription ${subscriptionId} for invoice:`, error);
      }
    }

    // Get payment intent error if available
    let failureCode: string | undefined;
    let failureReason: string | undefined;
    
    if (invoice.payment_intent) {
      try {
        const paymentIntent = await this.stripeClient.retrievePaymentIntent(invoice.payment_intent as string);
        failureCode = paymentIntent.last_payment_error?.code;
        failureReason = paymentIntent.last_payment_error?.message;
      } catch (error) {
        console.error(`Error retrieving payment intent ${invoice.payment_intent} for invoice:`, error);
      }
    }

    // Publish as payment_failed event (same type, invoice is just another source)
    const billingEvent: BillingEvent.PaymentFailedEvent = {
      type: BillingEvent.PaymentEventType.PAYMENT_FAILED,
      payload: {
        paymentIntentId: invoice.payment_intent as string || invoice.id,
        userId: customer.userId,
        amount: invoice.amount_due / 100,
        currency: invoice.currency.toUpperCase(),
        priceId: priceId || "",
        productId: productId,
        subscriptionId: subscriptionId,
        provider: "stripe",
        failureCode,
        failureReason,
        portalUrl,
        expiresAt,
      },
      meta: this.eventPublisher.createMetadata("stripe"),
      version: 1,
    };

    await this.eventPublisher.publish(billingEvent);
  }

  private async handleInvoicePaid(event: Stripe.Event): Promise<void> {
    const invoice = event.data.object as Stripe.Invoice;
    const customer = await this.customerRepo.findByStripeCustomerId(invoice.customer as string);
    
    if (!customer) {
      throw new Error(`Customer not found for Stripe customer ID: ${invoice.customer}`);
    }

    // Get subscription/product info from invoice
    const subscriptionId = invoice.subscription as string | undefined;
    let productId: string | undefined;
    let priceId: string | undefined;

    if (subscriptionId) {
      try {
        const subscription = await this.stripeClient.retrieveSubscription(subscriptionId);
        productId = await this.resolveProductId(subscription);
        priceId = subscription.items.data[0]?.price.id || subscription.metadata.priceId || "";
      } catch (error) {
        console.error(`Error retrieving subscription ${subscriptionId} for invoice:`, error);
      }
    }

    // Determine billing type: one-time if no subscription, recurring if subscription exists
    const billingType = subscriptionId ? "recurring" : "one_time";

    // Publish as payment_successful event
    const billingEvent: BillingEvent.PaymentSuccessfulEvent = {
      type: BillingEvent.PaymentEventType.PAYMENT_SUCCESSFUL,
      payload: {
        paymentIntentId: invoice.payment_intent as string || invoice.id,
        userId: customer.userId,
        amount: invoice.amount_paid / 100,
        currency: invoice.currency.toUpperCase(),
        priceId: priceId || "",
        productId: productId,
        subscriptionId: subscriptionId,
        billingType: billingType as "one_time" | "recurring",
        provider: "stripe",
      },
      meta: this.eventPublisher.createMetadata("stripe"),
      version: 1,
    };

    await this.eventPublisher.publish(billingEvent);
  }

  /**
   * Generates a Stripe Customer Portal session URL for resolving billing issues
   */
  private async generatePortalUrl(stripeCustomerId: string): Promise<string> {
    try {
      // Use a default return URL - in production, this should be configurable
      const returnUrl = process.env.PORTAL_RETURN_URL || "https://app.is-ed.com/billing";
      
      const portalSession = await this.stripeClient.createPortalSession({
        customerId: stripeCustomerId,
        returnUrl,
      });

      return portalSession.url;
    } catch (error) {
      console.error(`Error generating portal URL for customer ${stripeCustomerId}:`, error);
      // Return empty string if portal generation fails - dunning service can regenerate
      return "";
    }
  }

  /**
   * Safely extracts current period start/end from subscription, with fallbacks
   * Handles cases where subscription is incomplete and these fields may be missing
   */
  private getSubscriptionPeriodDates(subscription: Stripe.Subscription): {
    currentPeriodStart: string;
    currentPeriodEnd: string;
  } {
    // Try subscription-level fields first
    let periodStart: number | null | undefined = subscription.current_period_start;
    let periodEnd: number | null | undefined = subscription.current_period_end;

    // Fallback to subscription items if not available at subscription level
    if ((!periodStart || !periodEnd) && subscription.items?.data?.[0]) {
      const firstItem = subscription.items.data[0];
      periodStart = periodStart ?? (firstItem as any).current_period_start;
      periodEnd = periodEnd ?? (firstItem as any).current_period_end;
    }

    // Convert to ISO strings, handling null/undefined
    // If still missing, use subscription.created or current time as fallback
    const fallbackTimestamp = subscription.created || Math.floor(Date.now() / 1000);
    
    const startTimestamp = periodStart ?? fallbackTimestamp;
    const endTimestamp = periodEnd ?? fallbackTimestamp;

    return {
      currentPeriodStart: new Date(startTimestamp * 1000).toISOString(),
      currentPeriodEnd: new Date(endTimestamp * 1000).toISOString(),
    };
  }

  private async handleSubscriptionCreated(event: Stripe.Event): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription;
    const customer = await this.customerRepo.findByStripeCustomerId(subscription.customer as string);
    
    if (!customer) {
      throw new Error(`Customer not found for Stripe customer ID: ${subscription.customer}`);
    }

    // Resolve productId from metadata or fallback to Stripe product lookup
    const productId = await this.resolveProductId(subscription);

    const periodDates = this.getSubscriptionPeriodDates(subscription);

    // Extract add-on product IDs from metadata
    const addonProductIds = subscription.metadata?.addonProductIds
      ? subscription.metadata.addonProductIds.split(",").filter(id => id.trim())
      : undefined;

    const billingEvent: BillingEvent.SubscriptionCreatedEvent = {
      type: BillingEvent.SubscriptionEventType.SUBSCRIPTION_CREATED,
      payload: {
        subscriptionId: subscription.id,
        userId: customer.userId,
        productId,
        priceId: subscription.items.data[0]?.price.id || subscription.metadata.priceId || "",
        status: subscription.status as any,
        currentPeriodStart: periodDates.currentPeriodStart,
        currentPeriodEnd: periodDates.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        addonProductIds,
      },
      meta: this.eventPublisher.createMetadata("stripe"),
      version: 1,
    };

    await this.eventPublisher.publish(billingEvent);
  }

  private async handleSubscriptionUpdated(event: Stripe.Event): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription;
    const previousAttributes = (event.data as any).previous_attributes || {};
    const customer = await this.customerRepo.findByStripeCustomerId(subscription.customer as string);
    
    if (!customer) {
      throw new Error(`Customer not found for Stripe customer ID: ${subscription.customer}`);
    }

    // Resolve new productId from current subscription metadata
    const productId = await this.resolveProductId(subscription);

    // Try to get previous productId from multiple sources:
    // 1. From previous_attributes (Stripe webhook includes this when metadata changes)
    // 2. From current metadata.previousProductId (set by CreatePaymentIntentUseCase when updating)
    let previousProductId: string | undefined;
    
    if (previousAttributes.metadata && previousAttributes.metadata.productId) {
      // Get from Stripe's previous_attributes (most reliable)
      previousProductId = previousAttributes.metadata.productId;
    } else if (subscription.metadata?.previousProductId) {
      // Fallback: get from current metadata (set by our update logic)
      previousProductId = subscription.metadata.previousProductId;
    }
    
    // Only use previousProductId if it's different from current productId
    if (previousProductId === productId) {
      previousProductId = undefined; // Product didn't actually change
    }
    
    if (previousProductId) {
      console.log(`Subscription ${subscription.id} product changed from ${previousProductId} to ${productId}`);
    }

    const periodDates = this.getSubscriptionPeriodDates(subscription);

    // Extract add-on product IDs from metadata
    const addonProductIds = subscription.metadata?.addonProductIds
      ? subscription.metadata.addonProductIds.split(",").filter(id => id.trim())
      : undefined;

    const billingEvent: BillingEvent.SubscriptionUpdatedEvent = {
      type: BillingEvent.SubscriptionEventType.SUBSCRIPTION_UPDATED,
      payload: {
        subscriptionId: subscription.id,
        userId: customer.userId,
        productId,
        priceId: subscription.items.data[0]?.price.id || subscription.metadata.priceId || "",
        status: subscription.status as any,
        currentPeriodStart: periodDates.currentPeriodStart,
        currentPeriodEnd: periodDates.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        previousProductId, // Include old productId if available
        addonProductIds,
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

    const periodDates = this.getSubscriptionPeriodDates(subscription);

    // Extract add-on product IDs from metadata
    const addonProductIds = subscription.metadata?.addonProductIds
      ? subscription.metadata.addonProductIds.split(",").filter(id => id.trim())
      : undefined;

    const billingEvent = {
      type: eventType,
      payload: {
        subscriptionId: subscription.id,
        userId: customer.userId,
        productId,
        priceId: subscription.items.data[0]?.price.id || subscription.metadata.priceId || "",
        status: subscription.status as any,
        currentPeriodStart: periodDates.currentPeriodStart,
        currentPeriodEnd: periodDates.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        addonProductIds,
      },
      meta: this.eventPublisher.createMetadata("stripe"),
      version: 1,
    };

    await this.eventPublisher.publish(billingEvent as any);
  }

  private async getCustomerFromPaymentIntent(paymentIntent: Stripe.PaymentIntent): Promise<{ userId: string; stripeCustomerId: string }> {
    if (paymentIntent.customer) {
      const stripeCustomerId = paymentIntent.customer as string;
      const customer = await this.customerRepo.findByStripeCustomerId(stripeCustomerId);
      if (customer) {
        return { userId: customer.userId, stripeCustomerId };
      }
      // If customer not found in our DB but exists in Stripe, try to get userId from metadata
      if (paymentIntent.metadata.userId) {
        return { userId: paymentIntent.metadata.userId, stripeCustomerId };
      }
      throw new Error(`Customer ${stripeCustomerId} not found in database and no userId in payment intent metadata`);
    }

    // Fallback to metadata (but we still need Stripe customer ID for portal URL)
    if (paymentIntent.metadata.userId) {
      throw new Error(`Payment intent ${paymentIntent.id} has userId but no Stripe customer ID - cannot generate portal URL`);
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

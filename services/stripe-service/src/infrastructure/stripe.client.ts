import Stripe from "stripe";

export class StripeClient {
  private readonly client: Stripe;

  constructor() {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
      throw new Error("STRIPE_SECRET_KEY environment variable is not set");
    }
    this.client = new Stripe(apiKey, {
      apiVersion: "2023-10-16",
    });
  }

  getClient(): Stripe {
    return this.client;
  }

  async createProduct(name: string, description?: string): Promise<Stripe.Product> {
    return await this.client.products.create({
      name,
      description,
    });
  }

  async createPrice(params: {
    productId: string;
    unitAmount: number;
    currency: string;
    recurring?: {
      interval: "day" | "week" | "month" | "year";
      intervalCount?: number;
    };
  }): Promise<Stripe.Price> {
    const priceParams: Stripe.PriceCreateParams = {
      product: params.productId,
      unit_amount: params.unitAmount,
      currency: params.currency.toLowerCase(),
    };

    if (params.recurring) {
      priceParams.recurring = {
        interval: params.recurring.interval,
        interval_count: params.recurring.intervalCount || 1,
      };
    }

    return await this.client.prices.create(priceParams);
  }

  async createCustomer(params: {
    email?: string;
    name?: string;
    metadata?: Record<string, string>;
  }): Promise<Stripe.Customer> {
    return await this.client.customers.create({
      email: params.email,
      name: params.name,
      metadata: params.metadata || {},
    });
  }

  async createCheckoutSession(params: {
    customerId: string;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
    metadata?: Record<string, string>;
  }): Promise<Stripe.Checkout.Session> {
    return await this.client.checkout.sessions.create({
      customer: params.customerId,
      line_items: [
        {
          price: params.priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: params.metadata || {},
      // subscription_data.metadata ensures metadata is attached to the subscription when created
      // This is critical for linking subscriptions back to internal products
      subscription_data: {
        metadata: params.metadata || {},
      },
    });
  }

  async retrieveProduct(productId: string): Promise<Stripe.Product> {
    return await this.client.products.retrieve(productId);
  }

  async retrievePrice(priceId: string): Promise<Stripe.Price> {
    return await this.client.prices.retrieve(priceId);
  }

  async retrieveCustomer(customerId: string): Promise<Stripe.Customer> {
    return await this.client.customers.retrieve(customerId) as Stripe.Customer;
  }

  async retrievePaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    return await this.client.paymentIntents.retrieve(paymentIntentId);
  }

  async retrieveSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return await this.client.subscriptions.retrieve(subscriptionId);
  }

  /**
   * Lists all active subscriptions for a customer
   */
  async listCustomerSubscriptions(customerId: string): Promise<Stripe.Subscription[]> {
    const subscriptions = await this.client.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 100,
    });
    return subscriptions.data;
  }

  /**
   * Updates an existing subscription to use a new price
   */
  async updateSubscription(
    subscriptionId: string,
    params: {
      priceId: string;
      metadata?: Record<string, string>;
    }
  ): Promise<Stripe.Subscription> {
    // Get current subscription to find subscription item ID
    const subscription = await this.retrieveSubscription(subscriptionId);
    
    if (!subscription.items.data[0]) {
      throw new Error(`Subscription ${subscriptionId} has no items`);
    }

    const subscriptionItemId = subscription.items.data[0].id;

    // Update subscription with new price
    return await this.client.subscriptions.update(subscriptionId, {
      items: [
        {
          id: subscriptionItemId,
          price: params.priceId,
        },
      ],
      metadata: params.metadata || subscription.metadata,
      // Ensure metadata is also in subscription_data for new items
      default_source: undefined,
    });
  }

  /**
   * Creates a Stripe Customer Portal session for managing billing
   * This allows customers to update payment methods, view invoices, and resolve billing issues
   */
  async createPortalSession(params: {
    customerId: string;
    returnUrl: string;
  }): Promise<Stripe.BillingPortal.Session> {
    return await this.client.billingPortal.sessions.create({
      customer: params.customerId,
      return_url: params.returnUrl,
    });
  }

  constructEvent(
    payload: string | Buffer,
    signature: string,
    secret: string
  ): Stripe.Event {
    return this.client.webhooks.constructEvent(payload, signature, secret);
  }
}

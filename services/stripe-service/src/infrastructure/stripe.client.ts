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
    mode?: "payment" | "subscription"; // Defaults to "subscription" for backward compatibility
    addonLineItems?: Array<{ priceId: string; productId: string }>;
    successUrl: string;
    cancelUrl: string;
    metadata?: Record<string, string>;
  }): Promise<Stripe.Checkout.Session> {
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price: params.priceId,
        quantity: 1,
      },
    ];

    // Add add-on line items (only for subscriptions)
    if (params.mode !== "payment" && params.addonLineItems && params.addonLineItems.length > 0) {
      for (const addon of params.addonLineItems) {
        lineItems.push({
          price: addon.priceId,
          quantity: 1,
        });
      }
    }

    const mode = params.mode || "subscription";
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: params.customerId,
      line_items: lineItems,
      mode,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: params.metadata || {},
    };

    // Only include subscription_data for subscription mode
    if (mode === "subscription") {
      sessionParams.subscription_data = {
        metadata: params.metadata || {},
      };
    }

    return await this.client.checkout.sessions.create(sessionParams);
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
   * Updates an existing subscription to use a new price and add-ons
   * Stripe automatically handles proration for subscription items
   */
  async updateSubscription(
    subscriptionId: string,
    params: {
      priceId: string;
      addonLineItems?: Array<{ priceId: string; productId: string }>;
      metadata?: Record<string, string>;
    }
  ): Promise<Stripe.Subscription> {
    // Get current subscription to find subscription item IDs
    const subscription = await this.retrieveSubscription(subscriptionId);
    
    if (!subscription.items.data[0]) {
      throw new Error(`Subscription ${subscriptionId} has no items`);
    }

    const mainSubscriptionItemId = subscription.items.data[0].id;
    const items: Stripe.SubscriptionUpdateParams.Item[] = [
      {
        id: mainSubscriptionItemId,
        price: params.priceId,
      },
    ];

    // Handle add-ons
    if (params.addonLineItems && params.addonLineItems.length > 0) {
      // Get existing add-on subscription items (items after the first one)
      const existingAddonItems = subscription.items.data.slice(1);
      const newAddonPriceIds = new Set(params.addonLineItems.map(addon => addon.priceId));

      // Update or add add-on items
      for (const addon of params.addonLineItems) {
        const existingAddonItem = existingAddonItems.find(item => item.price.id === addon.priceId);
        
        if (existingAddonItem) {
          // Update existing add-on item (Stripe will prorate automatically)
          items.push({
            id: existingAddonItem.id,
            price: addon.priceId,
          });
        } else {
          // Add new add-on item (Stripe will prorate from now until next billing cycle)
          items.push({
            price: addon.priceId,
            quantity: 1,
          });
        }
      }

      // Remove add-ons that are no longer included
      for (const existingItem of existingAddonItems) {
        const stillIncluded = newAddonPriceIds.has(existingItem.price.id);
        if (!stillIncluded) {
          items.push({
            id: existingItem.id,
            deleted: true, // Remove this subscription item
          });
        }
      }
    } else {
      // Remove all existing add-ons if none are provided
      const existingAddonItems = subscription.items.data.slice(1);
      for (const existingItem of existingAddonItems) {
        items.push({
          id: existingItem.id,
          deleted: true,
        });
      }
    }

    // Update subscription with new price and add-ons
    // Stripe automatically handles proration for all items
    return await this.client.subscriptions.update(subscriptionId, {
      items: items,
      proration_behavior: "create_prorations", // Automatically prorate add-ons
      metadata: params.metadata || subscription.metadata,
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

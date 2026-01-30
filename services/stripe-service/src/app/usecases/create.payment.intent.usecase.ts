import Stripe from "stripe";
import { StripeClient } from "../../infrastructure/stripe.client";
import { StripeCustomerRepository } from "../../infrastructure/stripe-customer.repository";
import { GetProductUseCase, GetPriceUseCase, UpdateProductUseCase, UpdatePriceUseCase, BillingType, Interval, ListPricesByProductUseCase, ProductType } from "@libs/domain";

export interface CreatePaymentIntentInput {
  userId: string;
  userRole?: string;
  userEmail?: string;
  priceId: string;
  addonProductIds?: string[]; // Optional array of add-on product IDs to attach
  paymentMethodId?: string; // Optional: user can specify which payment method to use
  successUrl: string;
  cancelUrl: string;
}

export interface CreatePaymentIntentOutput {
  // Checkout flow (if no payment method available)
  checkoutUrl?: string;
  
  // Direct payment flow (if payment method used)
  paymentIntentId?: string;
  subscriptionId?: string;
  status?: "succeeded" | "requires_action" | "requires_payment_method" | "processing";
  clientSecret?: string; // For 3D Secure or other authentication
  requiresAction?: boolean;
  
  // Processing status details
  isProcessing?: boolean; // Explicit flag for processing state
  nextAction?: {
    type: "poll_status" | "wait_for_webhook" | "complete_payment";
    pollEndpoint?: string; // Endpoint to poll for status updates
    estimatedCompletionTime?: number; // Estimated seconds until completion
    message?: string; // Human-readable message for the action
    requiresClientSecret?: boolean; // Whether clientSecret is required for this action
  };
  
  customerId: string;
  isUpdate: boolean;
}

export class CreatePaymentIntentUseCase {
  constructor(
    private readonly stripeClient: StripeClient,
    private readonly customerRepo: StripeCustomerRepository,
    private readonly getProductUseCase: GetProductUseCase,
    private readonly getPriceUseCase: GetPriceUseCase,
    private readonly updateProductUseCase: UpdateProductUseCase,
    private readonly updatePriceUseCase: UpdatePriceUseCase,
    private readonly listPricesByProductUseCase: ListPricesByProductUseCase
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

    // Process add-ons if provided
    const addonLineItems: Array<{ priceId: string; productId: string }> = [];
    const addonProductIds: string[] = [];
    
    if (input.addonProductIds && input.addonProductIds.length > 0) {
      for (const addonProductId of input.addonProductIds) {
        const addonProduct = await this.getProductUseCase.execute(addonProductId);
        
        if (addonProduct.type !== ProductType.ADDON) {
          throw new Error(`Product ${addonProductId} is not an add-on product`);
        }

        // Get the first price for the add-on (or use addonConfig pricing if available)
        const addonPrices = await this.listPricesByProductUseCase.execute({
          productId: addonProductId,
          pageNumber: 1,
          pageSize: 1,
        });

        if (addonPrices.items.length === 0) {
          throw new Error(`No price found for add-on product ${addonProductId}`);
        }

        const addonPrice = addonPrices.items[0];
        let addonStripeProductId = addonProduct.providers?.stripe;
        let addonStripePriceId = addonPrice.providers?.stripe;

        // Create Stripe product if needed
        if (!addonStripeProductId) {
          const stripeProduct = await this.stripeClient.createProduct(
            addonProduct.name,
            addonProduct.description
          );
          addonStripeProductId = stripeProduct.id;
          await this.updateProductUseCase.execute(addonProductId, {
            providers: {
              ...addonProduct.providers,
              stripe: addonStripeProductId,
            },
          });
        }

        // Create Stripe price if needed
        if (!addonStripePriceId) {
          const recurring = addonPrice.billingType === BillingType.RECURRING ? {
            interval: this.mapInterval(addonPrice.interval!),
            intervalCount: addonPrice.frequency,
          } : undefined;

          const stripePrice = await this.stripeClient.createPrice({
            productId: addonStripeProductId,
            unitAmount: Math.round(addonPrice.amount * 100),
            currency: addonPrice.currency,
            recurring,
          });
          addonStripePriceId = stripePrice.id;
          await this.updatePriceUseCase.execute(addonPrice.priceId, {
            providers: {
              ...addonPrice.providers,
              stripe: addonStripePriceId,
            },
          });
        }

        addonLineItems.push({ priceId: addonStripePriceId, productId: addonProductId });
        addonProductIds.push(addonProductId);
      }
    }

    // For one-time payments, don't check for existing subscriptions
    // One-time payments are separate from subscriptions
    const isOneTime = price.billingType === BillingType.ONE_TIME;
    
    // Check for existing active subscriptions (only for recurring payments)
    // If user already has a subscription, update it instead of creating a new one
    const existingSubscriptions = isOneTime ? [] : await this.stripeClient.listCustomerSubscriptions(stripeCustomerId);
    
    if (!isOneTime && existingSubscriptions.length > 0) {
      // User has an existing subscription - update it instead of creating a new one
      // This prevents double billing and automatically handles proration
      const existingSubscription = existingSubscriptions[0]; // Take the first active subscription
      
      console.log(`Updating existing subscription ${existingSubscription.id} for customer ${stripeCustomerId}`);
      
      // Get the old productId from the existing subscription metadata
      // This will be used by the webhook to remove entitlements from the old product
      const oldProductId = existingSubscription.metadata?.productId;
      
      // Update the subscription with the new price and add-ons
      // Stripe automatically handles proration for subscription items
      const updatedSubscription = await this.stripeClient.updateSubscription(
        existingSubscription.id,
        {
          priceId: stripePriceId!,
          addonLineItems: addonLineItems.length > 0 ? addonLineItems : undefined,
          metadata: {
            userId: input.userId,
            priceId: input.priceId,
            productId: product.productId,
            ...(addonProductIds.length > 0 ? { addonProductIds: addonProductIds.join(",") } : {}),
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

    // Get customer's payment methods
    const stripeCustomer = await this.stripeClient.retrieveCustomer(stripeCustomerId);
    const paymentMethods = await this.stripeClient.listCustomerPaymentMethods(stripeCustomerId);
    const defaultPaymentMethodId = typeof stripeCustomer.invoice_settings?.default_payment_method === "string"
      ? stripeCustomer.invoice_settings.default_payment_method
      : stripeCustomer.invoice_settings?.default_payment_method?.toString();
    
    const defaultPaymentMethod = paymentMethods.find(pm => pm.id === defaultPaymentMethodId) 
      || paymentMethods[0]; // Use first if no default set
    
    // Determine which payment method to use
    let paymentMethodToUse: Stripe.PaymentMethod | null = null;
    if (input.paymentMethodId) {
      // User specified a payment method
      paymentMethodToUse = paymentMethods.find(pm => pm.id === input.paymentMethodId) || null;
      if (!paymentMethodToUse) {
        throw new Error(`Payment method ${input.paymentMethodId} not found for customer`);
      }
    } else if (defaultPaymentMethod) {
      // Use default payment method
      paymentMethodToUse = defaultPaymentMethod;
    }

    // If one-time payment and we have a payment method, try direct PaymentIntent
    if (isOneTime && paymentMethodToUse) {
      const paymentIntent = await this.stripeClient.createPaymentIntent({
        customerId: stripeCustomerId,
        paymentMethodId: paymentMethodToUse.id,
        amount: Math.round(price.amount * 100),
        currency: price.currency,
        metadata: {
          userId: input.userId,
          priceId: input.priceId,
          productId: product.productId,
        },
        confirm: true,
        returnUrl: input.successUrl, // Required when Stripe allows redirect-based payment methods (e.g. 3DS)
      });

      const isProcessing = paymentIntent.status === "processing";
      const requiresAction = paymentIntent.status === "requires_action";

      return {
        customerId: stripeCustomerId,
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status as any,
        clientSecret: paymentIntent.client_secret || undefined,
        requiresAction,
        isProcessing,
        nextAction: isProcessing ? {
          type: "poll_status",
          pollEndpoint: `/stripe/payment-intent/${paymentIntent.id}/status`,
          estimatedCompletionTime: 30, // Seconds - adjust based on payment method type
        } : requiresAction ? {
          type: "complete_payment",
          message: "Use Stripe.js with the clientSecret to complete 3D Secure authentication",
          requiresClientSecret: true,
        } : undefined,
        isUpdate: false,
      };
    }

    // If subscription and we have a payment method, try direct Subscription
    if (!isOneTime && paymentMethodToUse && existingSubscriptions.length === 0) {
      const subscription = await this.stripeClient.createSubscriptionWithPaymentMethod({
        customerId: stripeCustomerId,
        paymentMethodId: paymentMethodToUse.id,
        priceId: stripePriceId!,
        addonPriceIds: addonLineItems.map(item => item.priceId),
        metadata: {
          userId: input.userId,
          priceId: input.priceId,
          productId: product.productId,
          billingType: "recurring",
          ...(addonProductIds.length > 0 ? { addonProductIds: addonProductIds.join(",") } : {}),
        },
      });

      // Check if subscription requires action (via latest invoice payment intent)
      const latestInvoice = subscription.latest_invoice as Stripe.Invoice;
      const paymentIntent = latestInvoice?.payment_intent as Stripe.PaymentIntent | null;

      if (paymentIntent) {
        const isProcessing = paymentIntent.status === "processing";
        const requiresAction = paymentIntent.status === "requires_action";

        return {
          customerId: stripeCustomerId,
          subscriptionId: subscription.id,
          paymentIntentId: paymentIntent.id,
          status: paymentIntent.status as any,
          clientSecret: paymentIntent.client_secret || undefined,
          requiresAction,
          isProcessing,
          nextAction: isProcessing ? {
            type: "poll_status",
            pollEndpoint: `/stripe/payment-intent/${paymentIntent.id}/status`,
            estimatedCompletionTime: 30,
          } : requiresAction ? {
            type: "complete_payment",
            message: "Use Stripe.js with the clientSecret to complete 3D Secure authentication",
            requiresClientSecret: true,
          } : undefined,
          isUpdate: false,
        };
      }

      // Subscription created successfully
      return {
        customerId: stripeCustomerId,
        subscriptionId: subscription.id,
        status: "succeeded",
        isUpdate: false,
      };
    }

    // Fall back to checkout session (no payment method or user preference)
    const session = await this.stripeClient.createCheckoutSession({
      customerId: stripeCustomerId,
      priceId: stripePriceId!,
      mode: isOneTime ? "payment" : "subscription",
      addonLineItems: isOneTime ? undefined : (addonLineItems.length > 0 ? addonLineItems : undefined), // Add-ons only for subscriptions
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
      metadata: {
        userId: input.userId,
        priceId: input.priceId,
        productId: product.productId,
        billingType: isOneTime ? "one_time" : "recurring",
        ...(addonProductIds.length > 0 ? { addonProductIds: addonProductIds.join(",") } : {}),
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

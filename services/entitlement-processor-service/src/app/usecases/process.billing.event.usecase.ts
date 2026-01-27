import {
  EntitlementRepository,
  EntitlementRole,
  EntitlementStatus,
  EntitlementKey,
  CreateEntitlementUseCase,
  SyncProductLimitsToEntitlementsUseCase,
  ProductRepositoryPorts,
  BillingEvent
} from "@libs/domain";
import { EntitlementEventPublisher } from "../../infrastructure/event.publisher";

type BillingDomainEvent<T = any> = BillingEvent.BillingDomainEvent<T>;
type SubscriptionCreatedEvent = BillingEvent.SubscriptionCreatedEvent;
type SubscriptionUpdatedEvent = BillingEvent.SubscriptionUpdatedEvent;
type SubscriptionCanceledEvent = BillingEvent.SubscriptionCanceledEvent;
type SubscriptionExpiredEvent = BillingEvent.SubscriptionExpiredEvent;
type SubscriptionPausedEvent = BillingEvent.SubscriptionPausedEvent;
type SubscriptionResumedEvent = BillingEvent.SubscriptionResumedEvent;
type PaymentSuccessfulEvent = BillingEvent.PaymentSuccessfulEvent;
const PaymentEventType = BillingEvent.PaymentEventType;
const SubscriptionEventType = BillingEvent.SubscriptionEventType;

export class ProcessBillingEventUseCase {
  constructor(
    private readonly createEntitlementUseCase: CreateEntitlementUseCase,
    private readonly syncProductLimitsUseCase: SyncProductLimitsToEntitlementsUseCase,
    private readonly eventPublisher: EntitlementEventPublisher,
    private readonly entitlementRepo: EntitlementRepository,
    private readonly productRepo: ProductRepositoryPorts.ProductRepository
  ) {}

  async execute(event: BillingDomainEvent<any>): Promise<void> {
    // Filter out irrelevant events
    if (event.type === PaymentEventType.PAYMENT_FAILED || 
        event.type === PaymentEventType.PAYMENT_ACTION_REQUIRED) {
      console.log(`Skipping irrelevant event: ${event.type}`);
      return;
    }

    const role = this.extractRole(event);
    if (!role) {
      console.warn(`No role found in event ${event.type}, defaulting to LEARNER`);
    }

    switch (event.type) {
      case SubscriptionEventType.SUBSCRIPTION_CREATED:
        await this.handleSubscriptionCreated(event as SubscriptionCreatedEvent, role);
        break;
      case SubscriptionEventType.SUBSCRIPTION_UPDATED:
        await this.handleSubscriptionUpdated(event as SubscriptionUpdatedEvent, role);
        break;
      case SubscriptionEventType.SUBSCRIPTION_CANCELED:
        await this.handleSubscriptionCanceled(event as SubscriptionCanceledEvent);
        break;
      case SubscriptionEventType.SUBSCRIPTION_EXPIRED:
        await this.handleSubscriptionExpired(event as SubscriptionExpiredEvent);
        break;
      case SubscriptionEventType.SUBSCRIPTION_PAUSED:
        await this.handleSubscriptionPaused(event as SubscriptionPausedEvent);
        break;
      case SubscriptionEventType.SUBSCRIPTION_RESUMED:
        await this.handleSubscriptionResumed(event as SubscriptionResumedEvent);
        break;
      case PaymentEventType.PAYMENT_SUCCESSFUL:
        await this.handlePaymentSuccessful(event as PaymentSuccessfulEvent, role);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  }

  private extractRole(event: BillingDomainEvent<any>): EntitlementRole {
    // Role is not in event payload, default to LEARNER
    // In the future, this could fetch from a user service
    return EntitlementRole.LEARNER;
  }

  private async handleSubscriptionCreated(
    event: SubscriptionCreatedEvent,
    role: EntitlementRole
  ): Promise<void> {
    const { userId, productId, currentPeriodEnd } = event.payload;
    const expiresAt = new Date(currentPeriodEnd);

    // Create entitlements from product
    await this.createEntitlementsFromProduct(userId, productId, role, expiresAt);

    // Process add-ons
    await this.processAddons(userId, productId, role, expiresAt);

    // Publish events for created entitlements
    await this.publishEntitlementEvents(userId, productId, "subscription.created", event.meta);
  }

  private async handleSubscriptionUpdated(
    event: SubscriptionUpdatedEvent,
    role: EntitlementRole
  ): Promise<void> {
    const { userId, productId, currentPeriodEnd } = event.payload;
    const expiresAt = new Date(currentPeriodEnd);

    // Update entitlements (recreate/update)
    await this.createEntitlementsFromProduct(userId, productId, role, expiresAt);

    // Process add-ons (may have changed)
    await this.processAddons(userId, productId, role, expiresAt);

    await this.publishEntitlementEvents(userId, productId, "subscription.updated", event.meta);
  }

  private async handleSubscriptionCanceled(
    event: SubscriptionCanceledEvent
  ): Promise<void> {
    const { userId, productId, cancelAtPeriodEnd, currentPeriodEnd } = event.payload;

    if (cancelAtPeriodEnd) {
      // Revoke at period end
      const expiresAt = new Date(currentPeriodEnd);
      await this.revokeEntitlements(userId, productId, false, expiresAt);
    } else {
      // Revoke immediately
      await this.revokeEntitlements(userId, productId, true);
    }

    await this.publishEntitlementEvents(userId, productId, "subscription.canceled", event.meta);
  }

  private async handleSubscriptionExpired(
    event: SubscriptionExpiredEvent
  ): Promise<void> {
    const { userId, productId } = event.payload;

    await this.revokeEntitlements(userId, productId, true);

    await this.publishEntitlementEvents(userId, productId, "subscription.expired", event.meta);
  }

  private async handleSubscriptionPaused(
    event: SubscriptionPausedEvent
  ): Promise<void> {
    // Paused subscriptions keep entitlements but mark as inactive
    // This would require a new use case to update status only
    // For now, we'll leave entitlements active but they won't reset
    console.log(`Subscription paused for user ${event.payload.userId}, entitlements remain active`);
  }

  private async handleSubscriptionResumed(
    event: SubscriptionResumedEvent
  ): Promise<void> {
    const { userId, productId, currentPeriodEnd } = event.payload;
    const expiresAt = new Date(currentPeriodEnd);
    const userRole = EntitlementRole.LEARNER; // Default role

    // Re-activate entitlements
    await this.createEntitlementsFromProduct(userId, productId, userRole, expiresAt);

    await this.publishEntitlementEvents(userId, productId, "subscription.resumed", event.meta);
  }

  private async handlePaymentSuccessful(
    event: PaymentSuccessfulEvent,
    role: EntitlementRole
  ): Promise<void> {
    const { userId, productId } = event.payload;

    if (!productId) {
      console.log(`Payment successful but no productId, skipping entitlement creation`);
      return;
    }

    // For one-off purchases, create entitlements (no expiration unless product specifies)
    await this.createEntitlementsFromProduct(userId, productId, role, undefined);

    await this.publishEntitlementEvents(userId, productId, "payment.successful", event.meta);
  }

  private async publishEntitlementEvents(
    userId: string,
    productId: string,
    reason: string,
    metadata: any
  ): Promise<void> {
    try {
      // Fetch entitlements for the user
      const entitlements = await this.entitlementRepo.findByUser(userId);

      // Publish events for each entitlement
      for (const entitlement of entitlements) {
        const status: "active" | "inactive" = entitlement.status === EntitlementStatus.ACTIVE ? "active" : "inactive";
        
        const payload = {
          userId: entitlement.userId,
          entitlementKey: entitlement.key as string,
          role: entitlement.role as string,
          status,
          expiresAt: entitlement.expiresAt?.toISOString(),
          usageLimit: entitlement.usage
            ? {
                limit: entitlement.usage.limit,
                used: entitlement.usage.used
              }
            : undefined,
          productId,
          reason
        };

        // Determine event type based on reason
        if (reason.includes("created") || reason.includes("successful")) {
          await this.eventPublisher.publishCreated(payload, metadata);
        } else if (reason.includes("updated") || reason.includes("resumed")) {
          await this.eventPublisher.publishUpdated(payload, metadata);
        } else if (reason.includes("canceled") || reason.includes("expired") || reason.includes("revoked")) {
          await this.eventPublisher.publishRevoked(payload, metadata);
        }
      }
    } catch (error) {
      console.error("Error publishing entitlement events:", error);
      // Don't throw - event publishing failure shouldn't fail the main process
    }
  }

  /**
   * Creates entitlements for a user based on a product
   */
  private async createEntitlementsFromProduct(
    userId: string,
    productId: string,
    role: EntitlementRole,
    expiresAt?: Date
  ): Promise<void> {
    // Get product details
    const product = await this.productRepo.findById(productId);
    
    if (!product) {
      throw new Error(`Product ${productId} not found`);
    }

    // Create entitlements for each entitlement key in the product
    for (const entitlementKey of product.entitlements) {
      // Check if entitlement already exists
      const existing = await this.entitlementRepo.findByUserAndKey(userId, entitlementKey);
      
      if (existing) {
        // Update existing entitlement
        existing.status = EntitlementStatus.ACTIVE;
        if (expiresAt) {
          existing.expiresAt = expiresAt;
        }
        await this.entitlementRepo.update(existing);
      } else {
        // Create new entitlement
        await this.createEntitlementUseCase.execute({
          userId,
          key: entitlementKey as EntitlementKey,
          role,
          expiresAt
        });
      }
    }

    // Sync product usage limits to entitlements
    await this.syncProductLimitsUseCase.execute({
      productId,
      userId
    });
  }

  /**
   * Processes add-ons for a product subscription
   */
  private async processAddons(
    userId: string,
    productId: string,
    role: EntitlementRole,
    expiresAt?: Date
  ): Promise<void> {
    const product = await this.productRepo.findById(productId);
    
    if (!product) {
      throw new Error(`Product ${productId} not found`);
    }

    // Process addonConfigs (preferred) or legacy addons
    const addonConfigs = product.addonConfigs || [];
    const legacyAddons = product.addons || [];

    // Process addonConfigs
    for (const addonConfig of addonConfigs) {
      await this.createEntitlementsFromProduct(
        userId,
        addonConfig.productId,
        role,
        expiresAt
      );
    }

    // Process legacy addons
    for (const addonProductId of legacyAddons) {
      await this.createEntitlementsFromProduct(
        userId,
        addonProductId,
        role,
        expiresAt
      );
    }
  }

  /**
   * Revokes entitlements for a user based on a product
   */
  private async revokeEntitlements(
    userId: string,
    productId: string,
    immediate: boolean,
    expiresAt?: Date
  ): Promise<void> {
    const product = await this.productRepo.findById(productId);
    
    if (!product) {
      throw new Error(`Product ${productId} not found`);
    }

    // Revoke entitlements for each entitlement key in the product
    for (const entitlementKey of product.entitlements) {
      const entitlement = await this.entitlementRepo.findByUserAndKey(userId, entitlementKey);
      
      if (entitlement) {
        if (immediate) {
          entitlement.status = EntitlementStatus.REVOKED;
          entitlement.expiresAt = undefined;
        } else if (expiresAt) {
          // Set expiration date but keep active until then
          entitlement.expiresAt = expiresAt;
        }
        await this.entitlementRepo.update(entitlement);
      }
    }

    // Also revoke add-on entitlements
    const addonConfigs = product.addonConfigs || [];
    const legacyAddons = product.addons || [];

    for (const addonConfig of addonConfigs) {
      await this.revokeEntitlements(userId, addonConfig.productId, immediate, expiresAt);
    }

    for (const addonProductId of legacyAddons) {
      await this.revokeEntitlements(userId, addonProductId, immediate, expiresAt);
    }
  }
}

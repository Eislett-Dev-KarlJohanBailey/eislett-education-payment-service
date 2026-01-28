import {
  BillingEvent,
  DunningRepository,
  DunningRecord,
  DunningState,
} from "@libs/domain";
import { EntitlementEventPublisher } from "../../infrastructure/event.publisher";

type BillingDomainEvent<T = any> = BillingEvent.BillingDomainEvent<T>;
type PaymentActionRequiredEvent = BillingEvent.PaymentActionRequiredEvent;
type PaymentFailedEvent = BillingEvent.PaymentFailedEvent;
type PaymentSuccessfulEvent = BillingEvent.PaymentSuccessfulEvent;
type SubscriptionUpdatedEvent = BillingEvent.SubscriptionUpdatedEvent;
const PaymentEventType = BillingEvent.PaymentEventType;
const SubscriptionEventType = BillingEvent.SubscriptionEventType;

export class ProcessBillingEventUseCase {
  constructor(
    private readonly dunningRepo: DunningRepository,
    private readonly entitlementEventPublisher: EntitlementEventPublisher
  ) {}

  async execute(event: BillingDomainEvent<any>): Promise<void> {
    switch (event.type) {
      case PaymentEventType.PAYMENT_ACTION_REQUIRED:
        await this.handlePaymentActionRequired(event as PaymentActionRequiredEvent);
        break;
      case PaymentEventType.PAYMENT_FAILED:
        await this.handlePaymentFailed(event as PaymentFailedEvent);
        break;
      case PaymentEventType.PAYMENT_SUCCESSFUL:
        await this.handlePaymentSuccessful(event as PaymentSuccessfulEvent);
        break;
      case SubscriptionEventType.SUBSCRIPTION_UPDATED:
        // Check if subscription was updated to active (recovery)
        await this.handleSubscriptionUpdated(event as SubscriptionUpdatedEvent);
        break;
      default:
        console.log(`Unhandled event type for dunning: ${event.type}`);
    }
  }

  /**
   * Day 0: Payment action required detected
   * Sets state to ACTION_REQUIRED, generates portal URL
   */
  private async handlePaymentActionRequired(event: PaymentActionRequiredEvent): Promise<void> {
    const { userId, portalUrl, expiresAt, paymentIntentId } = event.payload;

    // Check if there's an existing dunning record
    const existing = await this.dunningRepo.findByUserId(userId);

    if (existing) {
      // Update existing record with new billing issue
      // Reset to ACTION_REQUIRED and update portal URL
      existing.updateState(DunningState.ACTION_REQUIRED);
      if (portalUrl) {
        existing.updatePortalUrl(portalUrl);
      }
      if (expiresAt) {
        (existing as any)._expiresAt = new Date(expiresAt);
      }
      (existing as any)._paymentIntentId = paymentIntentId;
      (existing as any)._detectedAt = new Date(); // Reset detection time for new billing issue
      (existing as any)._lastUpdatedAt = new Date();

      await this.dunningRepo.save(existing);
      console.log(`Dunning state updated to ACTION_REQUIRED for user ${userId}`);
    } else {
      // Create new record
      const record = new DunningRecord({
        userId,
        state: DunningState.ACTION_REQUIRED,
        portalUrl,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        detectedAt: new Date(),
        lastUpdatedAt: new Date(),
        paymentIntentId,
      });

      await this.dunningRepo.save(record);
      console.log(`Dunning state set to ACTION_REQUIRED for user ${userId}`);
    }
  }

  /**
   * Day 0: Payment failed detected
   * Sets state to ACTION_REQUIRED, generates portal URL
   */
  private async handlePaymentFailed(event: PaymentFailedEvent): Promise<void> {
    const { userId, portalUrl, expiresAt, paymentIntentId, failureCode, failureReason } = event.payload;

    const existing = await this.dunningRepo.findByUserId(userId);

    if (existing) {
      // Update existing record with new billing issue
      existing.updateState(DunningState.ACTION_REQUIRED);
      if (portalUrl) {
        existing.updatePortalUrl(portalUrl);
      }
      if (expiresAt) {
        (existing as any)._expiresAt = new Date(expiresAt);
      }
      (existing as any)._paymentIntentId = paymentIntentId;
      (existing as any)._failureCode = failureCode;
      (existing as any)._failureReason = failureReason;
      (existing as any)._detectedAt = new Date(); // Reset detection time for new billing issue
      (existing as any)._lastUpdatedAt = new Date();

      await this.dunningRepo.save(existing);
      console.log(`Dunning state updated to ACTION_REQUIRED for user ${userId} (payment failed)`);
    } else {
      // Create new record
      const record = new DunningRecord({
        userId,
        state: DunningState.ACTION_REQUIRED,
        portalUrl,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        detectedAt: new Date(),
        lastUpdatedAt: new Date(),
        paymentIntentId,
        failureCode,
        failureReason,
      });

      await this.dunningRepo.save(record);
      console.log(`Dunning state set to ACTION_REQUIRED for user ${userId} (payment failed)`);
    }
  }

  /**
   * Recovery: Payment successful - resolve billing issue
   */
  private async handlePaymentSuccessful(event: PaymentSuccessfulEvent): Promise<void> {
    const { userId } = event.payload;

    const existing = await this.dunningRepo.findByUserId(userId);

    if (existing && existing.state !== DunningState.OK) {
      existing.resolve();
      await this.dunningRepo.save(existing);
      console.log(`Dunning state resolved to OK for user ${userId} (payment successful)`);
    }
  }

  /**
   * Recovery: Subscription updated to active - resolve billing issue
   */
  private async handleSubscriptionUpdated(event: SubscriptionUpdatedEvent): Promise<void> {
    const { userId, status } = event.payload;

    // Only resolve if subscription is now active
    if (status === "active") {
      const existing = await this.dunningRepo.findByUserId(userId);

      if (existing && existing.state !== DunningState.OK) {
        existing.resolve();
        await this.dunningRepo.save(existing);
        console.log(`Dunning state resolved to OK for user ${userId} (subscription active)`);
      }
    }
  }

  /**
   * Processes state transitions based on timeline
   * Should be called periodically (e.g., via scheduled Lambda)
   */
  async processStateTransitions(userId: string): Promise<void> {
    const record = await this.dunningRepo.findByUserId(userId);

    if (!record || record.state === DunningState.OK) {
      return;
    }

    if (record.shouldTransition()) {
      const currentState = record.state;
      const nextState = record.getNextState();

      if (nextState !== currentState) {
        record.updateState(nextState);

        // If transitioning to SUSPENDED, publish revocation event
        // Entitlement service will handle the actual revocation
        if (nextState === DunningState.SUSPENDED) {
          await this.publishEntitlementRevocation(userId);
        }

        await this.dunningRepo.save(record);
        console.log(`Dunning state transitioned from ${currentState} to ${nextState} for user ${userId}`);
      }
    }
  }

  /**
   * Publishes entitlement revocation event when account is suspended
   * The entitlement service will handle the actual revocation after checking dunning state
   */
  private async publishEntitlementRevocation(userId: string): Promise<void> {
    const metadata = {
      eventId: `dunning-${userId}-${Date.now()}`,
      occurredAt: new Date().toISOString(),
      source: "internal" as const,
    };

    // Publish event for other services to consume
    await this.entitlementEventPublisher.publishRevoked(
      {
        userId,
        entitlementKey: "*", // Special value to indicate all entitlements revoked
        status: "inactive",
        reason: "non_payment",
      },
      metadata
    );
    console.log(`Published entitlement revocation event for user ${userId} (non_payment)`);
  }
}

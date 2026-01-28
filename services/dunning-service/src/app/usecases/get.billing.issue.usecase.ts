import { DunningRepository, DunningState } from "@libs/domain";
import { EntitlementEventPublisher } from "../../infrastructure/event.publisher";

export interface BillingIssueResponse {
  hasIssue: boolean;
  state: DunningState;
  message: string;
  portalUrl?: string;
  expiresAt?: string;
  daysSinceDetection: number;
  actions: string[];
}

export class GetBillingIssueUseCase {
  constructor(
    private readonly dunningRepo: DunningRepository,
    private readonly entitlementEventPublisher?: EntitlementEventPublisher
  ) {}

  async execute(userId: string): Promise<BillingIssueResponse> {
    const record = await this.dunningRepo.findByUserId(userId);

    // Check if state should be transitioned before returning
    if (record && record.shouldTransition()) {
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
      }
    }

    if (!record || record.state === DunningState.OK) {
      return {
        hasIssue: false,
        state: DunningState.OK,
        message: "No billing issues",
        daysSinceDetection: 0,
        actions: [],
      };
    }

    const daysSince = record.getDaysSinceDetection();
    const { message, actions } = this.getStateMessage(record.state, daysSince);

    return {
      hasIssue: true,
      state: record.state,
      message,
      portalUrl: record.portalUrl,
      expiresAt: record.expiresAt?.toISOString(),
      daysSinceDetection: daysSince,
      actions,
    };
  }

  private getStateMessage(state: DunningState, daysSince: number): { message: string; actions: string[] } {
    switch (state) {
      case DunningState.ACTION_REQUIRED:
        return {
          message: "Payment action required. Please update your payment method to continue.",
          actions: [
            "Update your payment method using the portal link",
            "Contact support if you need assistance",
          ],
        };
      case DunningState.GRACE_PERIOD:
        const daysRemaining = 4 - daysSince;
        return {
          message: `Payment issue detected. Please resolve within ${daysRemaining} day(s) to avoid service restrictions.`,
          actions: [
            "Update your payment method using the portal link",
            "Your account will be restricted if not resolved soon",
          ],
        };
      case DunningState.RESTRICTED:
        const daysUntilSuspension = 8 - daysSince;
        return {
          message: `Your account has been restricted due to payment issues. Please resolve within ${daysUntilSuspension} day(s) to avoid suspension.`,
          actions: [
            "Update your payment method immediately using the portal link",
            "Premium features are currently disabled",
            "Your account will be suspended if not resolved",
          ],
        };
      case DunningState.SUSPENDED:
        return {
          message: "Your account has been suspended due to unresolved payment issues. Please update your payment method to restore access.",
          actions: [
            "Update your payment method using the portal link",
            "Contact support to restore your account",
            "Your account is recoverable - access will be restored once payment is resolved",
          ],
        };
      default:
        return {
          message: "No billing issues",
        actions: [],
      };
    }
  }

  /**
   * Publishes entitlement revocation event when account is suspended
   * The entitlement service will handle the actual revocation after checking dunning state
   */
  private async publishEntitlementRevocation(userId: string): Promise<void> {
    if (!this.entitlementEventPublisher) {
      return; // Optional - event publishing
    }

    const metadata = {
      eventId: `dunning-${userId}-${Date.now()}`,
      occurredAt: new Date().toISOString(),
      source: "internal" as const,
    };

    await this.entitlementEventPublisher.publishRevoked(
      {
        userId,
        entitlementKey: "*",
        status: "inactive",
        reason: "non_payment",
      },
      metadata
    );
    console.log(`Published entitlement revocation event for user ${userId} (non_payment)`);
  }
}


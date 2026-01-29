import { EntitlementRepository } from "@libs/domain";
import { UsageDomainEvent } from "@libs/domain";

export class ProcessUsageEventUseCase {
  constructor(private readonly entitlementRepo: EntitlementRepository) {}

  async execute(event: UsageDomainEvent): Promise<void> {
    const { userId, entitlementKey, amount } = event;

    const entitlement = await this.entitlementRepo.findByUserAndKey(
      userId,
      entitlementKey
    );

    if (!entitlement) {
      throw new Error(
        `Entitlement '${entitlementKey}' not found for user '${userId}'`
      );
    }

    if (!entitlement.isActive()) {
      throw new Error(
        `Entitlement '${entitlementKey}' is not active for user '${userId}'`
      );
    }

    if (!entitlement.usage) {
      throw new Error(
        `Entitlement '${entitlementKey}' has no usage tracking for user '${userId}'`
      );
    }

    // Lazy evaluation: reset usage if reset period has passed
    if (entitlement.usage.shouldReset()) {
      entitlement.usage.reset();
      await this.entitlementRepo.update(entitlement);
    }

    entitlement.usage.consume(amount);
    await this.entitlementRepo.update(entitlement);

    console.log(
      `Recorded usage: ${amount} for ${entitlementKey} (user: ${userId}), used: ${entitlement.usage.used}/${entitlement.usage.getEffectiveLimit()}`
    );
  }
}

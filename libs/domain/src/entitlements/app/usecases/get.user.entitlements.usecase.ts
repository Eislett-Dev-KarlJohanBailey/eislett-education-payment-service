import { EntitlementRepository } from "../ports/entitlement.repository";

export class GetUserEntitlementsUseCase {
  constructor(private readonly repo: EntitlementRepository) {}

  async execute(userId: string): Promise<Record<string, any>> {
    const entitlements = await this.repo.findByUser(userId);

    // Lazy evaluation: Check and reset usage for entitlements that need it
    // This ensures resets happen when users access their entitlements
    // Only processes active users, no empty runs
    let hasUpdates = false;
    for (const entitlement of entitlements) {
      if (entitlement.usage && entitlement.usage.shouldReset()) {
        entitlement.usage.reset();
        await this.repo.update(entitlement);
        hasUpdates = true;
        console.log(`Reset usage for entitlement ${entitlement.key} (user: ${userId}) due to reset period`);
      }
    }

    // If we made updates, re-fetch to ensure we return the latest state
    const finalEntitlements = hasUpdates 
      ? await this.repo.findByUser(userId)
      : entitlements;

    return finalEntitlements
      .filter(e => e.isActive())
      .reduce((acc, entitlement) => {
        acc[entitlement.key] = entitlement.usage
          ? {
              limit: entitlement.usage.getEffectiveLimit(),
              used: entitlement.usage.used,
            }
          : true;
        return acc;
      }, {} as Record<string, any>);
  }
}

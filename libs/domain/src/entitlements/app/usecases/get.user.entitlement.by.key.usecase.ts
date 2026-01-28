import { EntitlementRepository } from "../ports/entitlement.repository";
import { NotFoundError } from "../../domain/errors/not-found.error";

export class GetUserEntitlementByKeyUseCase {
  constructor(private readonly repo: EntitlementRepository) {}

  async execute(userId: string, entitlementKey: string): Promise<Record<string, any>> {
    const entitlement = await this.repo.findByUserAndKey(userId, entitlementKey);

    if (!entitlement) {
      throw new NotFoundError(`Entitlement '${entitlementKey}' not found for user '${userId}'`);
    }

    if (!entitlement.isActive()) {
      throw new NotFoundError(`Entitlement '${entitlementKey}' is not active for user '${userId}'`);
    }

    // Lazy evaluation: Check and reset usage if needed
    // This ensures resets happen when users access their entitlements
    // The shouldReset() method checks if resetAt date has passed
    if (entitlement.usage && entitlement.usage.shouldReset()) {
      entitlement.usage.reset();
      await this.repo.update(entitlement);
      console.log(`Reset usage for entitlement ${entitlementKey} (user: ${userId}) due to reset period`);
      
      // Re-fetch to ensure we return the latest state
      const updated = await this.repo.findByUserAndKey(userId, entitlementKey);
      if (updated) {
        return {
          [updated.key]: updated.usage
            ? {
                limit: updated.usage.getEffectiveLimit(),
                used: updated.usage.used,
              }
            : true
        };
      }
    }

    return {
      [entitlement.key]: entitlement.usage
        ? {
            limit: entitlement.usage.getEffectiveLimit(),
            used: entitlement.usage.used,
          }
        : true
    };
  }
}

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

    return {
      [entitlement.key]: entitlement.usage
        ? {
            limit: entitlement.usage.limit,
            used: entitlement.usage.used,
          }
        : true
    };
  }
}

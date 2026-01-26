import { EntitlementRepository } from "../ports/entitlement.repository";

export class GetUserEntitlementsUseCase {
  constructor(private readonly repo: EntitlementRepository) {}

  async execute(userId: string): Promise<Record<string, any>> {
    const entitlements = await this.repo.findByUser(userId);

    return entitlements
      .filter(e => e.isActive())
      .reduce((acc, entitlement) => {
        acc[entitlement.key] = entitlement.usage
          ? {
              limit: entitlement.usage.limit,
              used: entitlement.usage.used,
            }
          : true;
        return acc;
      }, {} as Record<string, any>);
  }
}

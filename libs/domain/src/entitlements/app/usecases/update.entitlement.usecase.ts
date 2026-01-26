import { EntitlementRepository } from "../ports/entitlement.repository";
import { EntitlementStatus } from "../../domain/value-objects/entitlement-status.vo";

interface UpdateEntitlementInput {
  userId: string;
  key: string;
  status?: EntitlementStatus;
  expiresAt?: Date;
  usageIncrement?: number;
}

export class UpdateEntitlementUseCase {
  constructor(private readonly repo: EntitlementRepository) {}

  async execute(input: UpdateEntitlementInput): Promise<void> {
    const entitlements = await this.repo.findByUser(input.userId);

    const entitlement = entitlements.find(e => e.key === input.key);
    if (!entitlement) {
      throw new Error("Entitlement not found");
    }

    if (input.status) {
      entitlement.status = input.status;
    }

    if (input.expiresAt) {
      entitlement.expiresAt = input.expiresAt;
    }

    if (input.usageIncrement && entitlement.usage) {
      entitlement.usage.consume(input.usageIncrement);
    }

    await this.repo.update(entitlement);
  }
}

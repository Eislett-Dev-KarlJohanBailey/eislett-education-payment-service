import { Entitlement } from "../../domain/entities/entitlement.entity";
import { EntitlementKey } from "../../domain/value-objects/entitlement-key.vo";
import { EntitlementRole } from "../../domain/value-objects/entitlement-role.vo";
import { EntitlementStatus } from "../../domain/value-objects/entitlement-status.vo";
import { EntitlementUsage } from "../../domain/entities/entitlement-usage.entity";
import { EntitlementRepository } from "../ports/entitlement.repository";

interface CreateEntitlementInput {
  userId: string;
  key: EntitlementKey;
  role: EntitlementRole;
  expiresAt?: Date;
  usageLimit?: number;
}

export class CreateEntitlementUseCase {
  constructor(private readonly repo: EntitlementRepository) {}

  async execute(input: CreateEntitlementInput): Promise<void> {
    const entitlement = new Entitlement(
      input.userId,
      input.key,
      input.role,
      EntitlementStatus.ACTIVE,
      new Date(),
      input.expiresAt,
      input.usageLimit
        ? new EntitlementUsage(input.usageLimit, 0)
        : undefined
    );

    await this.repo.save(entitlement);
  }
}

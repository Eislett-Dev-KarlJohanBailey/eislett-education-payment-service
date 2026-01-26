import { EntitlementKey } from "../value-objects/entitlement-key.vo";
import { EntitlementRole } from "../value-objects/entitlement-role.vo";
import { EntitlementStatus } from "../value-objects/entitlement-status.vo";
import { EntitlementUsage } from "./entitlement-usage.entity";

export class Entitlement {
  constructor(
    public readonly userId: string,
    public readonly key: EntitlementKey,
    public readonly role: EntitlementRole,
    public status: EntitlementStatus,
    public readonly grantedAt: Date,
    public expiresAt?: Date,
    public usage?: EntitlementUsage
  ) {}

  isActive(now = new Date()): boolean {
    if (this.status !== EntitlementStatus.ACTIVE) return false;
    if (!this.expiresAt) return true;
    return now < this.expiresAt;
  }
}

import { Entitlement } from "../../domain/entities/entitlement.entity";

export interface EntitlementRepository {
  findByUser(userId: string): Promise<Entitlement[]>;
  findByUserAndKey(userId: string, entitlementKey: string): Promise<Entitlement | null>;
  save(entitlement: Entitlement): Promise<void>;
  update(entitlement: Entitlement): Promise<void>;
  /** Delete all items in the entitlements table. Use only in dev. */
  deleteAll(): Promise<{ deleted: number }>;
  /** Delete one entitlement by user and key. */
  deleteByUserAndKey(userId: string, entitlementKey: string): Promise<boolean>;
}

import { Entitlement } from "../../domain/entities/entitlement.entity";

export interface EntitlementRepository {
  findByUser(userId: string): Promise<Entitlement[]>;
  findByUserAndKey(userId: string, entitlementKey: string): Promise<Entitlement | null>;
  save(entitlement: Entitlement): Promise<void>;
  update(entitlement: Entitlement): Promise<void>;
}

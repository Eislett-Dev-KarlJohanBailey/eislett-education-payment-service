import { Entitlement } from "../../domain/entities/entitlement.entity";

export interface EntitlementRepository {
  findByUser(userId: string): Promise<Entitlement[]>;
  save(entitlement: Entitlement): Promise<void>;
  update(entitlement: Entitlement): Promise<void>;
}

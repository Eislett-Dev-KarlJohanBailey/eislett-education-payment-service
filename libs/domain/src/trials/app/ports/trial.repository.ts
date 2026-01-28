import { TrialRecord } from "../../domain/entities/trial-record.entity";

export interface TrialRepository {
  findByUserAndProduct(userId: string, productId: string): Promise<TrialRecord | null>;
  findByUser(userId: string): Promise<TrialRecord[]>;
  save(trial: TrialRecord): Promise<void>;
  update(trial: TrialRecord): Promise<void>;
}

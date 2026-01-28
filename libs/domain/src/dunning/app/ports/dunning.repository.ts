import { DunningRecord } from "../../domain/entities/dunning-record.entity";

export interface DunningRepository {
  findByUserId(userId: string): Promise<DunningRecord | null>;
  save(record: DunningRecord): Promise<void>;
  delete(userId: string): Promise<void>;
}

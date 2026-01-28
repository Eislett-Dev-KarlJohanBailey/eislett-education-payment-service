import { Transaction } from "../../domain/entities/transaction.entity";

export interface TransactionRepository {
  save(transaction: Transaction): Promise<void>;
  findByUserId(userId: string, limit?: number): Promise<Transaction[]>;
  findAll(limit?: number): Promise<Transaction[]>;
  findById(transactionId: string): Promise<Transaction | null>;
}

import { TransactionRepository, Transaction } from "@libs/domain";

export interface GetAllTransactionsInput {
  limit?: number;
}

export class GetAllTransactionsUseCase {
  constructor(
    private readonly transactionRepo: TransactionRepository
  ) {}

  async execute(input: GetAllTransactionsInput): Promise<Transaction[]> {
    return await this.transactionRepo.findAll(input.limit);
  }
}

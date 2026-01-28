import { TransactionRepository, Transaction } from "@libs/domain";

export interface GetUserTransactionsInput {
  userId: string;
  limit?: number;
}

export class GetUserTransactionsUseCase {
  constructor(
    private readonly transactionRepo: TransactionRepository
  ) {}

  async execute(input: GetUserTransactionsInput): Promise<Transaction[]> {
    return await this.transactionRepo.findByUserId(input.userId, input.limit);
  }
}

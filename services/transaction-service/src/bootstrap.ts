import {
  DynamoTransactionRepository,
} from "@libs/domain";
import { ProcessBillingEventUseCase } from "./app/usecases/process.billing.event.usecase";
import { GetUserTransactionsUseCase } from "./app/usecases/get.user.transactions.usecase";
import { GetUserTransactionsController } from "./app/controllers/get.user.transactions.controller";

export function bootstrap() {
  const transactionsTableName = process.env.TRANSACTIONS_TABLE;

  if (!transactionsTableName) {
    throw new Error("TRANSACTIONS_TABLE environment variable is not set");
  }

  const transactionRepo = new DynamoTransactionRepository(transactionsTableName);

  const processBillingEventUseCase = new ProcessBillingEventUseCase(transactionRepo);
  const getUserTransactionsUseCase = new GetUserTransactionsUseCase(transactionRepo);

  return {
    processBillingEventUseCase,
    getUserTransactionsController: new GetUserTransactionsController(getUserTransactionsUseCase)
  };
}

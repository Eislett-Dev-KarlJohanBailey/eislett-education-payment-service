import { RequestContext } from "../../handler/api-gateway/types";
import { GetAllTransactionsUseCase } from "../usecases/get.all.transactions.usecase";

export class GetAllTransactionsController {
  constructor(
    private readonly useCase: GetAllTransactionsUseCase
  ) {}

  handle = async (req: RequestContext) => {
    const userRole = req.user?.role;

    // Only admin users can view all transactions
    if (userRole !== "ADMIN") {
      throw new Error("Unauthorized: Admin role required");
    }

    const limit = req.query.limit ? parseInt(req.query.limit, 10) : undefined;

    const transactions = await this.useCase.execute({ limit });

    return {
      transactions: transactions.map(t => ({
        transactionId: t.transactionId,
        userId: t.userId,
        type: t.type,
        status: t.status,
        amount: t.amount,
        currency: t.currency,
        productId: t.productId,
        priceId: t.priceId,
        subscriptionId: t.subscriptionId,
        createdAt: t.createdAt.toISOString(),
        metadata: t.metadata,
      })),
      count: transactions.length,
    };
  };
}

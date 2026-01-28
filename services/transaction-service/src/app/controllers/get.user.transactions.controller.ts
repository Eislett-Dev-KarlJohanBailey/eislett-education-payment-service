import { RequestContext } from "../../handler/api-gateway/types";
import { GetUserTransactionsUseCase } from "../usecases/get.user.transactions.usecase";

export class GetUserTransactionsController {
  constructor(
    private readonly useCase: GetUserTransactionsUseCase
  ) {}

  handle = async (req: RequestContext) => {
    const userId = req.query.userId || req.user?.id;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : undefined;

    if (!userId) {
      throw new Error("userId is required");
    }

    // Users can only view their own transactions unless they're admin
    const requestingUserId = req.user?.id;
    const isAdmin = req.user?.role === "ADMIN";

    if (!isAdmin && userId !== requestingUserId) {
      throw new Error("Unauthorized: You can only view your own transactions");
    }

    const transactions = await this.useCase.execute({ userId, limit });

    return {
      userId,
      transactions: transactions.map(t => ({
        transactionId: t.transactionId,
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

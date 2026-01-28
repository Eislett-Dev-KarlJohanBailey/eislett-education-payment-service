import { RequestContext } from "../../handler/api-gateway/types";
import { GetUserTransactionsUseCase } from "../usecases/get.user.transactions.usecase";

export class GetUserTransactionsController {
  constructor(
    private readonly useCase: GetUserTransactionsUseCase
  ) {}

  handle = async (req: RequestContext) => {
    const requestingUserId = req.user?.id;
    const userRole = req.user?.role;
    const isAdmin = userRole === "ADMIN";

    if (!requestingUserId) {
      throw new Error("User ID is required");
    }

    // Default to authenticated user's ID, but allow admins to filter by userId
    let userId = requestingUserId;
    if (isAdmin && req.query.userId) {
      userId = req.query.userId;
    } else if (!isAdmin && req.query.userId && req.query.userId !== requestingUserId) {
      // Non-admin users cannot filter by different userId
      throw new Error("Unauthorized: You can only view your own transactions");
    }

    const limit = req.query.limit ? parseInt(req.query.limit, 10) : undefined;

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

import { GetUserTransactionsController } from "../../../services/transaction-service/src/app/controllers/get.user.transactions.controller";

describe("GetUserTransactionsController", () => {
  it("passes provider filtering to the use case and returns provider in the response", async () => {
    const execute = jest.fn().mockResolvedValue([
      {
        transactionId: "txn_1",
        type: "payment.successful",
        status: "success",
        amount: 200,
        currency: "USD",
        productId: "product_1",
        priceId: "price_1",
        subscriptionId: undefined,
        provider: "powertranz",
        createdAt: new Date("2026-08-04T10:00:00.000Z"),
        metadata: {
          provider: "powertranz",
        },
      },
    ]);

    const controller = new GetUserTransactionsController({
      execute,
    } as any);

    const response = await controller.handle({
      method: "GET",
      path: "/transactions",
      pathParams: {},
      query: {
        provider: "PowerTranz",
        limit: "25",
      },
      body: null,
      user: {
        id: "user_1",
        role: "USER",
      },
    });

    expect(execute).toHaveBeenCalledWith({
      userId: "user_1",
      limit: 25,
      provider: "powertranz",
    });
    expect(response.transactions).toEqual([
      expect.objectContaining({
        provider: "powertranz",
        createdAt: "2026-08-04T10:00:00.000Z",
      }),
    ]);
  });
});

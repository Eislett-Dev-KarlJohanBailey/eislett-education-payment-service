import {
  BillingType,
  ProductType,
} from "@libs/domain";

describe("CreatePaymentIntentUseCase", () => {
  let CreatePaymentIntentUseCase: typeof import("../../../services/powertranz-service/src/app/usecases/create.payment.intent.usecase").CreatePaymentIntentUseCase;

  beforeAll(async () => {
    process.env.POWERTRANZ_MERCHANT_RESPONSE_URL =
      "https://example.test/powertranz/callback";
    delete process.env.POWERTRANZ_HPP_PAGE_SET;
    delete process.env.POWERTRANZ_HPP_PAGE_NAME;

    const mod = await import(
      "../../../services/powertranz-service/src/app/usecases/create.payment.intent.usecase"
    );
    CreatePaymentIntentUseCase = mod.CreatePaymentIntentUseCase;
  });

  const price = {
    priceId: "price_1",
    productId: "product_1",
    billingType: BillingType.ONE_TIME,
    interval: undefined,
    frequency: undefined,
    amount: 19.99,
    currency: "USD",
    providers: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const product = {
    productId: "product_1",
    name: "Practice Exam",
    description: "One-time purchase",
    type: ProductType.ONE_OFF,
    entitlements: [],
    usageLimits: {},
    addons: [],
    providers: {},
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  function buildUseCase() {
    const getPriceUseCase = {
      execute: jest.fn().mockResolvedValue(price),
    };
    const getProductUseCase = {
      execute: jest.fn().mockResolvedValue(product),
    };
    const powerTranzClient = {
      createSaleSpiToken: jest.fn().mockResolvedValue({
        spiToken: "spi_123",
        redirectData: "<form>redirect</form>",
        hostedPaymentPageHtml: "<form>redirect</form>",
        transactionIdentifier: "txn_123",
        orderIdentifier: "order_123",
      }),
    };
    const paymentIntentRepo = {
      save: jest.fn().mockResolvedValue(undefined),
    };

    return {
      useCase: new CreatePaymentIntentUseCase(
        getPriceUseCase as any,
        getProductUseCase as any,
        powerTranzClient as any,
        paymentIntentRepo as any,
      ),
      powerTranzClient,
      paymentIntentRepo,
    };
  }

  it("creates a hosted-page Sale request for USD", async () => {
    const { useCase, powerTranzClient, paymentIntentRepo } = buildUseCase();

    const result = await useCase.execute({
      userId: "user_1",
      userEmail: "buyer@example.com",
      priceId: "price_1",
    });

    expect(powerTranzClient.createSaleSpiToken).toHaveBeenCalledWith(
      expect.objectContaining({
        TotalAmount: 19.99,
        CurrencyCode: "840",
        ThreeDSecure: true,
        Source: {},
        BillingAddress: expect.objectContaining({
          EmailAddress: "buyer@example.com",
        }),
        ExtendedData: expect.objectContaining({
          MerchantResponseUrl: "https://example.test/powertranz/callback",
          HostedPage: expect.objectContaining({
            PageSet: "PTZ/Basic",
            PageName: "Simple",
          }),
        }),
      }),
    );
    expect(paymentIntentRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        spiToken: "spi_123",
        currency: "USD",
        transactionId: "txn_123",
        orderIdentifier: "order_123",
        status: "pending_payment",
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        redirectData: "<form>redirect</form>",
        hostedPaymentPageHtml: "<form>redirect</form>",
        spiToken: "spi_123",
        currency: "USD",
      }),
    );
  });

  it("rejects non-USD prices", async () => {
    const { useCase } = buildUseCase();
    jest
      .spyOn((useCase as any).getPriceUseCase, "execute")
      .mockResolvedValue({ ...price, currency: "TTD" });

    await expect(
      useCase.execute({ userId: "user_1", priceId: "price_1" }),
    ).rejects.toThrow("Only USD is supported");
  });
});

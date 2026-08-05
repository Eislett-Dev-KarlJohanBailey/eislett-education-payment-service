import { HandlePowerTranzCallbackUseCase } from "../../../services/powertranz-service/src/app/usecases/handle.powertranz.callback.usecase";

describe("HandlePowerTranzCallbackUseCase", () => {
  const baseIntent = {
    id: "intent_1",
    userId: "user_1",
    userEmail: "buyer@example.com",
    priceId: "price_1",
    productId: "product_1",
    spiToken: "spi_123",
    amount: 1500,
    currency: "TTD",
    status: "pending_payment" as const,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
  };

  function buildUseCase() {
    const powerTranzClient = {
      chargePayment: jest.fn(),
      capturePayment: jest.fn(),
    };

    const paymentIntentRepo = {
      findBySpiToken: jest.fn().mockResolvedValue(baseIntent),
      updateBySpiToken: jest.fn().mockResolvedValue(undefined),
    };

    const emailQueue = {
      send: jest.fn().mockResolvedValue(undefined),
    };

    const billingEventPublisher = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const transactionRepo = {
      save: jest.fn().mockResolvedValue(undefined),
    };

    const useCase = new HandlePowerTranzCallbackUseCase(
      powerTranzClient as any,
      paymentIntentRepo as any,
      emailQueue as any,
      billingEventPublisher as any,
      transactionRepo as any,
    );

    return {
      useCase,
      powerTranzClient,
      paymentIntentRepo,
      emailQueue,
      billingEventPublisher,
      transactionRepo,
    };
  }

  it("marks the intent completed, saves the transaction, publishes billing, and queues success email", async () => {
    const {
      useCase,
      powerTranzClient,
      paymentIntentRepo,
      emailQueue,
      billingEventPublisher,
      transactionRepo,
    } = buildUseCase();

    powerTranzClient.chargePayment.mockResolvedValue({
      IsoResponseCode: "00",
      TransactionIdentifier: "txn_123",
      ResponseMessage: "Approved",
      TotalAmount: 1500,
      CurrencyCode: "840",
    });
    powerTranzClient.capturePayment.mockResolvedValue({
      IsoResponseCode: "00",
      TransactionIdentifier: "txn_123",
      ResponseMessage: "Captured",
    });

    await useCase.execute({
      spiToken: "spi_123",
      rawPayload: {
        SpiToken: "spi_123",
        AuthenticationStatus: "Y",
        IsoResponseCode: "3D0",
      },
    });

    expect(powerTranzClient.chargePayment).toHaveBeenCalledWith("spi_123");
    expect(powerTranzClient.capturePayment).toHaveBeenCalledWith({
      TransactionIdentifier: "txn_123",
      TotalAmount: 1500,
      CurrencyCode: "840",
    });
    expect(paymentIntentRepo.updateBySpiToken).toHaveBeenCalledWith(
      "spi_123",
      expect.objectContaining({
        status: "completed",
        transactionId: "txn_123",
        paidAt: expect.any(String),
        isoResponseCode: "00",
        responseMessage: "Captured",
      }),
    );
    expect(transactionRepo.save).toHaveBeenCalledTimes(1);
    expect(billingEventPublisher.publish).toHaveBeenCalledTimes(1);
    expect(emailQueue.send).toHaveBeenCalledWith(
      expect.objectContaining({
        template: "payment-successful.hbs",
        to: "buyer@example.com",
      }),
    );
  });

  it("marks the intent failed and queues a failure email when 3DS fails", async () => {
    const {
      useCase,
      powerTranzClient,
      paymentIntentRepo,
      emailQueue,
      billingEventPublisher,
      transactionRepo,
    } = buildUseCase();

    await useCase.execute({
      spiToken: "spi_123",
      rawPayload: {
        SpiToken: "spi_123",
        AuthenticationStatus: "N",
        IsoResponseCode: "3D1",
      },
    });

    expect(powerTranzClient.chargePayment).not.toHaveBeenCalled();
    expect(paymentIntentRepo.updateBySpiToken).toHaveBeenCalledWith(
      "spi_123",
      expect.objectContaining({
        status: "failed",
        failedAt: expect.any(String),
        approved: false,
      }),
    );
    expect(emailQueue.send).toHaveBeenCalledWith(
      expect.objectContaining({
        template: "payment-failed.hbs",
        to: "buyer@example.com",
      }),
    );
    expect(transactionRepo.save).not.toHaveBeenCalled();
    expect(billingEventPublisher.publish).not.toHaveBeenCalled();
  });

  it("does not complete payment when the callback only reports hosted-page preprocessing", async () => {
    const {
      useCase,
      powerTranzClient,
      paymentIntentRepo,
      emailQueue,
      billingEventPublisher,
      transactionRepo,
    } = buildUseCase();

    const result = await useCase.execute({
      spiToken: "spi_123",
      rawPayload: {
        SpiToken: "spi_123",
        IsoResponseCode: "HP0",
        ResponseMessage: "HPP preprocessing complete",
      },
    });

    expect(result).toEqual({
      status: "cancel",
      spiToken: "spi_123",
      transactionId: undefined,
      orderIdentifier: undefined,
    });
    expect(powerTranzClient.chargePayment).not.toHaveBeenCalled();
    expect(powerTranzClient.capturePayment).not.toHaveBeenCalled();
    expect(paymentIntentRepo.updateBySpiToken).toHaveBeenCalledWith(
      "spi_123",
      expect.objectContaining({
        status: "failed",
        failedAt: expect.any(String),
        approved: false,
        isoResponseCode: "HP0",
        responseMessage: "HPP preprocessing complete",
      }),
    );
    expect(emailQueue.send).toHaveBeenCalledWith(
      expect.objectContaining({
        template: "payment-failed.hbs",
        to: "buyer@example.com",
      }),
    );
    expect(transactionRepo.save).not.toHaveBeenCalled();
    expect(billingEventPublisher.publish).not.toHaveBeenCalled();
  });

  it("marks the intent failed and queues a failure email when PowerTranz declines", async () => {
    const {
      useCase,
      powerTranzClient,
      paymentIntentRepo,
      emailQueue,
      billingEventPublisher,
      transactionRepo,
    } = buildUseCase();

    powerTranzClient.chargePayment.mockResolvedValue({
      IsoResponseCode: "05",
      ResponseMessage: "Declined",
    });

    await useCase.execute({
      spiToken: "spi_123",
      rawPayload: {
        SpiToken: "spi_123",
        AuthenticationStatus: "Y",
        IsoResponseCode: "3D0",
      },
    });

    expect(powerTranzClient.chargePayment).toHaveBeenCalledTimes(1);
    expect(powerTranzClient.capturePayment).not.toHaveBeenCalled();
    expect(paymentIntentRepo.updateBySpiToken).toHaveBeenCalledWith(
      "spi_123",
      expect.objectContaining({
        status: "failed",
        failedAt: expect.any(String),
        isoResponseCode: "05",
        responseMessage: "Declined",
      }),
    );
    expect(emailQueue.send).toHaveBeenCalledWith(
      expect.objectContaining({
        template: "payment-failed.hbs",
        to: "buyer@example.com",
      }),
    );
    expect(transactionRepo.save).not.toHaveBeenCalled();
    expect(billingEventPublisher.publish).not.toHaveBeenCalled();
  });

  it("marks the intent failed and queues a failure email when capture declines", async () => {
    const {
      useCase,
      powerTranzClient,
      paymentIntentRepo,
      emailQueue,
      billingEventPublisher,
      transactionRepo,
    } = buildUseCase();

    powerTranzClient.chargePayment.mockResolvedValue({
      IsoResponseCode: "00",
      TransactionIdentifier: "txn_123",
      ResponseMessage: "Approved",
      TotalAmount: 1500,
      CurrencyCode: "840",
    });
    powerTranzClient.capturePayment.mockResolvedValue({
      IsoResponseCode: "05",
      ResponseMessage: "Capture declined",
      TransactionIdentifier: "txn_123",
    });

    await useCase.execute({
      spiToken: "spi_123",
      rawPayload: {
        SpiToken: "spi_123",
        AuthenticationStatus: "Y",
        IsoResponseCode: "3D0",
      },
    });

    expect(powerTranzClient.capturePayment).toHaveBeenCalledTimes(1);
    expect(paymentIntentRepo.updateBySpiToken).toHaveBeenCalledWith(
      "spi_123",
      expect.objectContaining({
        status: "failed",
        failedAt: expect.any(String),
        isoResponseCode: "05",
        responseMessage: "Capture declined",
      }),
    );
    expect(emailQueue.send).toHaveBeenCalledWith(
      expect.objectContaining({
        template: "payment-failed.hbs",
        to: "buyer@example.com",
      }),
    );
    expect(transactionRepo.save).not.toHaveBeenCalled();
    expect(billingEventPublisher.publish).not.toHaveBeenCalled();
  });
});

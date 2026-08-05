import { PowerTranzClient } from "../../../services/powertranz-service/src/infrastructure/powertranz.client";

describe("PowerTranzClient", () => {
  it("creates an Auth SPI token using the auth endpoint", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        SpiToken: "spi_123",
        RedirectData: "<form>redirect</form>",
        TransactionIdentifier: "txn_123",
        OrderIdentifier: "order_123",
      }),
    });

    const client = new PowerTranzClient(
      "https://staging.ptranz.com",
      fetchImpl as any,
      "merchant_123",
      "password_123",
    );

    const result = await client.createAuthSpiToken({
      TransactionIdentifier: "txn_123",
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://staging.ptranz.com/api/spi/auth",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ TransactionIdentifier: "txn_123" }),
      }),
    );
    expect(result).toEqual({
      spiToken: "spi_123",
      redirectData: "<form>redirect</form>",
      hostedPaymentPageHtml: "<form>redirect</form>",
      transactionIdentifier: "txn_123",
      orderIdentifier: "order_123",
    });
  });

  it("posts the JSON stringified SPI token when completing payment", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        IsoResponseCode: "00",
        ResponseMessage: "Transaction is approved.",
      }),
    });

    const client = new PowerTranzClient(
      "https://staging.ptranz.com",
      fetchImpl as any,
      "merchant_123",
      "password_123",
    );

    await client.chargePayment("spi_123");

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://staging.ptranz.com/api/spi/payment",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify("spi_123"),
      }),
    );
  });
});

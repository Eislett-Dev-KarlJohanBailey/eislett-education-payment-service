import { PowerTranzCallbackController } from "../../../services/powertranz-service/src/app/controllers/powertranz.callback.controller";

describe("PowerTranzCallbackController", () => {
  function buildController() {
    const useCase = {
      execute: jest.fn().mockResolvedValue(undefined),
    };

    return {
      controller: new PowerTranzCallbackController(useCase as any),
      useCase,
    };
  }

  it("unwraps PowerTranz Response JSON and processes the nested SpiToken", async () => {
    const { controller, useCase } = buildController();

    const result = await controller.handle({
      method: "POST",
      path: "/powertranz/callback",
      pathParams: {},
      query: {},
      headers: {},
      body: {
        Response: JSON.stringify({
          SpiToken: "spi_123",
          AuthenticationStatus: "Y",
          IsoResponseCode: "3D0",
        }),
      },
    });

    expect(result).toEqual({ ok: true });
    expect(useCase.execute).toHaveBeenCalledWith({
      spiToken: "spi_123",
      rawPayload: expect.objectContaining({
        SpiToken: "spi_123",
        AuthenticationStatus: "Y",
        IsoResponseCode: "3D0",
      }),
    });
  });

  it("rejects an invalid Response JSON wrapper", async () => {
    const { controller, useCase } = buildController();

    await expect(
      controller.handle({
        method: "POST",
        path: "/powertranz/callback",
        pathParams: {},
        query: {},
        headers: {},
        body: {
          Response: "{not-json",
        },
      }),
    ).rejects.toThrow("Invalid callback payload");

    expect(useCase.execute).not.toHaveBeenCalled();
  });
});

import { RequestContext } from "../../handler/api-gateway/types";
import { ForbiddenError, BadRequestError } from "@libs/domain";
import config from "../../config";
import { HandlePowerTranzCallbackUseCase } from "../usecases/handle.powertranz.callback.usecase";

export class PowerTranzCallbackController {
  // for accepting the powertranz callback payload and then sends it to the usecase
  constructor(private readonly useCase: HandlePowerTranzCallbackUseCase) {}

  handle = async (req: RequestContext) => {
    const headerSecret = req.headers?.["x-powertranz-callback-secret"];

    if (
      config.powertranz.callbackSecret &&
      headerSecret !== config.powertranz.callbackSecret
    ) {
      throw new ForbiddenError("Forbidden");
    }

    if (!req.body || typeof req.body !== "object") {
      throw new BadRequestError("Invalid payload");
    }

    const spiToken = String((req.body as any).spi_token || "").trim();
    if (!spiToken) {
      throw new BadRequestError("spi_token is required in payload");
    }

    await this.useCase.execute({
      spiToken,
      rawPayload: req.body as Record<string, unknown>,
    });

    return { ok: true };
  };
}

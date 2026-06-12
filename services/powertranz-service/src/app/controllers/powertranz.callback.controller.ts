import { RequestContext } from "../../handler/api-gateway/types";
import { ForbiddenError } from "@libs/domain";
import config from "../../config";
import { HandlePowerTranzCallbackUseCase } from "../usecases/handle.powertranz.callback.usecase";
import { BadRequestError } from "../errors/bad-request.error";

export class PowerTranzCallbackController {
  // for accepting the powertranz callback payload and then sends it to the usecase
  constructor(private readonly useCase: HandlePowerTranzCallbackUseCase) {}

  private callbackPayload(body: Record<string, unknown>): Record<string, unknown> {
    const responseRaw = body.Response;
    if (typeof responseRaw !== "string" || !responseRaw.trim()) {
      return body;
    }

    try {
      const parsed = JSON.parse(responseRaw) as Record<string, unknown>;
      return {
        ...parsed,
        ...body,
        SpiToken: body.SpiToken ?? parsed.SpiToken,
      };
    } catch {
      throw new BadRequestError("Invalid callback payload: Response is not valid JSON");
    }
  }

  handle = async (req: RequestContext) => {
    const headerSecret = req.headers?.["x-powertranz-callback-secret"];
    const querySecret = req.query?.secret;

    if (
      config.powertranz.callbackSecret &&
      headerSecret !== config.powertranz.callbackSecret &&
      querySecret !== config.powertranz.callbackSecret
    ) {
      throw new ForbiddenError("Forbidden");
    }

    if (!req.body || typeof req.body !== "object") {
      throw new BadRequestError("Invalid payload");
    }

    const payload = this.callbackPayload(req.body as Record<string, unknown>);

    const spiToken = String(
      payload.SpiToken || payload.spiToken || "",
    ).trim();
    if (!spiToken) {
      throw new BadRequestError("SpiToken is required in payload");
    }

    await this.useCase.execute({
      spiToken,
      rawPayload: payload,
    });

    return { ok: true };
  };
}

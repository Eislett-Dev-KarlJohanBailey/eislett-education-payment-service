import { RequestContext } from "../../handler/api-gateway/types";
import config from "../../config";
import { HandlePowerTranzCallbackUseCase } from "../usecases/handle.powertranz.callback.usecase";
import { redirect } from "../../handler/api-gateway/response";

export class PowerTranzCallbackController {
  // for accepting the powertranz callback payload and then sends it to the usecase
  constructor(private readonly useCase: HandlePowerTranzCallbackUseCase) {}

  private successRedirect() {
    return redirect("/billing?payment=success");
  }

  private cancelRedirect() {
    return redirect("/?payment=cancel");
  }

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
      throw new Error("Invalid callback payload: Response is not valid JSON");
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
      return this.cancelRedirect();
    }

    const queryPayload = { ...(req.query ?? {}) };
    delete queryPayload.secret;

    const bodyPayload =
      req.body && typeof req.body === "object"
        ? (req.body as Record<string, unknown>)
        : {};

    const rawPayload = {
      ...queryPayload,
      ...bodyPayload,
    };

    if (Object.keys(rawPayload).length === 0) {
      return this.cancelRedirect();
    }

    let payload: Record<string, unknown>;
    try {
      payload = this.callbackPayload(rawPayload);
    } catch {
      return this.cancelRedirect();
    }

    const spiToken = String(
      payload.SpiToken || payload.spiToken || "",
    ).trim();
    if (!spiToken) {
      return this.cancelRedirect();
    }

    try {
      const result = await this.useCase.execute({
        spiToken,
        rawPayload: payload,
      });

      return result.status === "success"
        ? this.successRedirect()
        : this.cancelRedirect();
    } catch {
      return this.cancelRedirect();
    }
  };
}

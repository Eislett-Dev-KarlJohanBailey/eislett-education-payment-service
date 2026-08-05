import { RequestContext } from "../../handler/api-gateway/types";
import config from "../../config";
import { HandlePowerTranzCallbackUseCase } from "../usecases/handle.powertranz.callback.usecase";
import { redirect } from "../../handler/api-gateway/response";

export class PowerTranzCallbackController {
  // for accepting the powertranz callback payload and then sends it to the usecase
  constructor(private readonly useCase: HandlePowerTranzCallbackUseCase) {}

  private billingRedirect(
    payment: "success" | "cancel",
    details?: {
      spiToken?: string;
      transactionId?: string;
      orderIdentifier?: string;
    },
  ) {
    const url = new URL("/billing", "https://payments.is-ed.local");
    url.searchParams.set("payment", payment);

    if (details?.spiToken) {
      url.searchParams.set("spiToken", details.spiToken);
    }

    if (details?.transactionId) {
      url.searchParams.set("transactionIdentifier", details.transactionId);
    }

    if (details?.orderIdentifier) {
      url.searchParams.set("orderIdentifier", details.orderIdentifier);
    }

    return redirect(`${url.pathname}${url.search}`);
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
      return this.billingRedirect("cancel");
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
      return this.billingRedirect("cancel");
    }

    let payload: Record<string, unknown>;
    try {
      payload = this.callbackPayload(rawPayload);
    } catch {
      return this.billingRedirect("cancel");
    }

    const spiToken = String(
      payload.SpiToken || payload.spiToken || "",
    ).trim();
    if (!spiToken) {
      return this.billingRedirect("cancel");
    }

    try {
      const result = await this.useCase.execute({
        spiToken,
        rawPayload: payload,
      });

      return this.billingRedirect(result.status, {
        spiToken: result.spiToken,
        transactionId: result.transactionId,
        orderIdentifier: result.orderIdentifier,
      });
    } catch {
      return this.billingRedirect("cancel", {
        spiToken,
        transactionId: String(payload.TransactionIdentifier ?? "").trim() || undefined,
        orderIdentifier: String(payload.OrderIdentifier ?? "").trim() || undefined,
      });
    }
  };
}

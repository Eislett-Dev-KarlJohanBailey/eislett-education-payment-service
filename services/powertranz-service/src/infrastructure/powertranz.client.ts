import config from "../config";

type FetchLike = typeof fetch;

interface PaymentResponse {
  SpiToken?: string;
  spiToken?: string;
  RedirectData?: unknown;
  Html?: unknown;
  HTML?: unknown;
  HostedPageHtml?: unknown;
  TransactionIdentifier?: string;
  OrderIdentifier?: string;
}

export class PowerTranzClient {
  constructor(
    private readonly baseUrl: string = config.powertranz.baseUrl,
    private readonly fetchImpl: FetchLike = fetch,
    private readonly merchantId: string = config.powertranz.merchantId,
    private readonly merchantPassword: string = config.powertranz.merchantPassword,
  ) {}

  private url(path: string): string {
    const base = this.baseUrl.replace(/\/$/, "");
    if (!base) {
      throw new Error("POWERTRANZ_BASE_URL is not configured");
    }
    return `${base}${path.startsWith("/") ? path : `/${path}`}`;
  }

  private jsonHeaders(includeMerchantAuth = true): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    if (!includeMerchantAuth) {
      return headers;
    }

    if (this.merchantId) {
      headers["PowerTranz-PowerTranzId"] = this.merchantId;
    }

    if (this.merchantPassword) {
      headers["PowerTranz-PowerTranzPassword"] =
        this.merchantPassword;
    }

    return headers;
  }

  private paymentHeaders(): Record<string, string> {
    return {
      ...this.jsonHeaders(false),
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  async createAuthSpiToken(payload: Record<string, unknown>): Promise<{
    spiToken: string;
    redirectData?: unknown;
    hostedPaymentPageHtml?: string;
    transactionIdentifier?: string;
    orderIdentifier?: string;
  }> {
    const res = await this.fetchImpl(this.url("/api/spi/auth"), {
      method: "POST",
      headers: this.jsonHeaders(true),
      body: JSON.stringify(payload),
    });

    const raw = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(`PowerTranz auth failed: ${res.status}`);
    }

    const response = raw as PaymentResponse;

    const spiToken = String(response.SpiToken ?? response.spiToken ?? "").trim();
    if (!spiToken) {
      throw new Error("PowerTranz auth response missing SpiToken");
    }

    const hostedPaymentPageHtml = String(
      response.RedirectData ??
        response.Html ??
        response.HTML ??
        response.HostedPageHtml ??
        "",
    ).trim();

    return {
      spiToken,
      redirectData: response.RedirectData,
      ...(hostedPaymentPageHtml ? { hostedPaymentPageHtml } : {}),
      transactionIdentifier: response.TransactionIdentifier,
      orderIdentifier: response.OrderIdentifier,
    };
  }

  async chargePayment(spiToken: string): Promise<unknown> {
    const res = await this.fetchImpl(this.url("/api/spi/payment"), {
      method: "POST",
      headers: this.paymentHeaders(),
      body: JSON.stringify(spiToken),
    });

    const raw = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(`PowerTranz payment failed: ${res.status}`);
    }

    return raw;
  }

  async capturePayment(body: Record<string, unknown>): Promise<unknown> {
    const res = await this.fetchImpl(this.url("/api/capture"), {
      method: "POST",
      headers: this.jsonHeaders(true),
      body: JSON.stringify(body),
    });

    const raw = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(`PowerTranz capture failed: ${res.status}`);
    }

    return raw;
  }
}

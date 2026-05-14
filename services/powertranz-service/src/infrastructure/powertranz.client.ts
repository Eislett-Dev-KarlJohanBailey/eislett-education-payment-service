import config from "../config";

type FetchLike = typeof fetch;

interface PaymentResponse {
  SpiToken?: string;
  Html?: string;
  RedirectData?: unknown;
}

export class PowerTranzClient {
  constructor(
    private readonly baseUrl: string = config.powertranz.baseUrl,
    private readonly fetchImpl: FetchLike = fetch,
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

    if (config.powertranz.merchantId) {
      headers["PowerTranz-PowerTranzId"] = config.powertranz.merchantId;
    }

    if (config.powertranz.merchantPassword) {
      headers["PowerTranz-PowerTranzPassword"] =
        config.powertranz.merchantPassword;
    }

    return headers;
  }

  async createSpiToken(payload: Record<string, unknown>): Promise<{
    spiToken: string;
    hppHtml?: string;
    redirectData?: unknown;
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

    const spiToken = String(response.SpiToken ?? "").trim();
    if (!spiToken) {
      throw new Error("PowerTranz auth response missing SpiToken");
    }

    return {
      spiToken,
      hppHtml: response.Html,
      redirectData: response.RedirectData,
    };
  }

  async chargePayment(spiToken: string): Promise<unknown> {
    const res = await this.fetchImpl(this.url("/api/spi/payment"), {
      method: "POST",
      headers: this.jsonHeaders(false),
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

export interface PowerTranzConfig {
  baseUrl: string;
  merchantId: string;
  merchantPassword: string;
  callbackSecret: string;
  merchantResponseUrl: string;
  hostedPagePageSet: string;
  hostedPagePageName: string;
  usdTtdExchangeRate: number;
}

export interface PowerTranzServiceConfig {
  powertranz: PowerTranzConfig;
}

const config: PowerTranzServiceConfig = {
  powertranz: {
    baseUrl: process.env.POWERTRANZ_BASE_URL || "",
    merchantId: process.env.POWERTRANZ_MERCHANT_ID || "",
    merchantPassword: process.env.POWERTRANZ_MERCHANT_PASSWORD || "",
    callbackSecret: process.env.POWERTRANZ_CALLBACK_SECRET || "",
    merchantResponseUrl: process.env.POWERTRANZ_MERCHANT_RESPONSE_URL || "",
    hostedPagePageSet: process.env.POWERTRANZ_HPP_PAGE_SET || "Payment",
    hostedPagePageName: process.env.POWERTRANZ_HPP_PAGE_NAME || "Eislett",
    usdTtdExchangeRate: Number(process.env.USD_TTD_EXCHANGE_RATE || "6.8"),
  },
};

export default config;

export interface PowerTranzConfig {
  baseUrl: string;
  merchantId: string;
  merchantPassword: string;
  callbackSecret: string;
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
  },
};

export default config;

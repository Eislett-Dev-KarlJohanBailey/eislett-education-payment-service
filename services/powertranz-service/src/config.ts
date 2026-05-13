import "dotenv/config";

export default {
  powertranz: {
    baseUrl: process.env.POWERTRANZ_BASE_URL || "",
    merchantId: process.env.POWERTRANZ_MERCHANT_ID || "",
    merchantPassword: process.env.POWERTRANZ_MERCHANT_PASSWORD || "",
    callbackSecret: process.env.POWERTRANZ_CALLBACK_SECRET || "",
  },
};

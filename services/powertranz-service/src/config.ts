import "dotenv/config";

export default {
  powertranz: {
    baseUrl: process.env.POWERTRANZ_BASE_URL || "",
    merchantId: process.env.POWERTRANZ_MERCHANT_ID || "",
    merchantPassword: process.env.POWERTRANZ_MERCHANT_PASSWORD || "",
    callbackSecret: process.env.POWERTRANZ_CALLBACK_SECRET || "",
    merchantResponseUrl: process.env.POWERTRANZ_MERCHANT_RESPONSE_URL || "",
    frontendRedirectUrl: process.env.POWERTRANZ_FRONTEND_REDIRECT_URL || "",
    hppPageName: process.env.POWERTRANZ_HPP_PAGE_NAME || "Simple",
    hppPageSet: process.env.POWERTRANZ_HPP_PAGE_SET || "Basic",
    intentsTable: process.env.POWERTRANZ_INTENTS_TABLE || "",
  },
  billing: {
    topicArn: process.env.BILLING_EVENTS_TOPIC_ARN || "",
  },
};

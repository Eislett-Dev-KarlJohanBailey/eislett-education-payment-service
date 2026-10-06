import type { APIGatewayProxyEvent } from "aws-lambda";

jest.mock("../../services/access-service/src/handler/api-gateway/routes", () => ({ routes: {} }));
jest.mock("../../services/dunning-service/src/handler/api-gateway/routes", () => ({ routes: {} }));
jest.mock("../../services/email-service/src/handler/api-gateway/routes", () => ({ routes: {} }));
jest.mock("../../services/powertranz-service/src/handler/api-gateway/routes", () => ({ routes: {} }));
jest.mock("../../services/pricing-service/src/handler/api-gateway/routes", () => ({ routes: {} }));
jest.mock("../../services/product-service/src/handler/api-gateway/routes", () => ({ routes: {} }));
jest.mock("../../services/stripe-service/src/handler/api-gateway/routes", () => ({ routes: {} }));
jest.mock("../../services/token-service/src/handler/api-gateway/routes", () => ({ routes: {} }));
jest.mock("../../services/transaction-service/src/handler/api-gateway/routes", () => ({ routes: {} }));
jest.mock("../../services/trial-service/src/handler/api-gateway/routes", () => ({ routes: {} }));

import { apiHandler as accessHandler } from "../../services/access-service/src/handler/api-gateway/handler";
import { apiHandler as dunningHandler } from "../../services/dunning-service/src/handler/api-gateway/handler";
import { apiHandler as emailHandler } from "../../services/email-service/src/handler/api-gateway/handler";
import { apiHandler as powertranzHandler } from "../../services/powertranz-service/src/handler/api-gateway/handler";
import { apiHandler as pricingHandler } from "../../services/pricing-service/src/handler/api-gateway/handler";
import { apiHandler as productHandler } from "../../services/product-service/src/handler/api-gateway/handler";
import { apiHandler as stripeHandler } from "../../services/stripe-service/src/handler/api-gateway/handler";
import { apiHandler as tokenHandler } from "../../services/token-service/src/handler/api-gateway/handler";
import { apiHandler as transactionHandler } from "../../services/transaction-service/src/handler/api-gateway/handler";
import { apiHandler as trialHandler } from "../../services/trial-service/src/handler/api-gateway/handler";

const event = {
  httpMethod: "OPTIONS",
  path: "/v1/prices/product/is-honours-bundle",
  resource: "/prices/{proxy+}",
} as APIGatewayProxyEvent;

const handlers = {
  access: accessHandler,
  dunning: dunningHandler,
  email: emailHandler,
  powertranz: powertranzHandler,
  pricing: pricingHandler,
  product: productHandler,
  stripe: stripeHandler,
  token: tokenHandler,
  transaction: transactionHandler,
  trial: trialHandler,
};

describe.each(Object.entries(handlers))("%s API CORS", (_name, handler) => {
  it("handles preflight before routing or authentication", async () => {
    const result = await handler(event);

    expect(result).toEqual({
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods":
          "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": expect.stringContaining("X-API-Key"),
      },
      body: "",
    });
  });
});

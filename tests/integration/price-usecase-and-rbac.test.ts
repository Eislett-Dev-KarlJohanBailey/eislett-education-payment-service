import {
  createAllTables,
  deleteAllTables,
  clearTable,
  setTestEnvVars,
  TABLE_NAMES,
} from "../helpers/localstack";
import { seedProductForPricingPostTests } from "../helpers/pricing-service-seed";
import { createJwtWithRole } from "../helpers/jwt-test-helper";
import { handler } from "../../services/pricing-service/src/handler";
import { createApiGatewayEvent } from "../helpers/fixtures";

describe("Pricing Service - Use Case and RBAC Integration Tests", () => {
  beforeAll(async () => {
    await createAllTables();
    setTestEnvVars();
    process.env.JWT_ACCESS_TOKEN_SECRET =
      process.env.JWT_ACCESS_TOKEN_SECRET || "test-jwt-secret-for-e2e";
  });

  afterAll(async () => {
    await deleteAllTables();
  });

  beforeEach(async () => {
    await clearTable(TABLE_NAMES.products);
    await clearTable(TABLE_NAMES.prices);
    await seedProductForPricingPostTests();
  });

  const body = JSON.stringify({
    productId: "pricing-seed-product-1",
    billingType: "one_time",
    amount: 1999,
    currency: "USD",
  });

  const forbiddenRoles = [
    "learner",
    "teacher",
    "random-role",
    "ADMINISTRATORX",
    "",
  ];

  it("returns 401 when no JWT token is provided", async () => {
    const event = createApiGatewayEvent({
      httpMethod: "POST",
      path: "/prices",
      resource: "/prices",
      body,
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(401);
  });
});

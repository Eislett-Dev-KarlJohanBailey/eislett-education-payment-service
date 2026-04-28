import {
  createAllTables,
  deleteAllTables,
  clearTable,
  setTestEnvVars,
  TABLE_NAMES,
} from "../helpers/localstack";
import { createApiGatewayEvent } from "../helpers/fixtures";

let handler: typeof import("../../services/product-service/src/handler/index")["handler"];

describe("Product Service E2E", () => {
  beforeAll(async () => {
    await createAllTables();
    setTestEnvVars();

    const mod = await import(
      "../../services/product-service/src/handler/index"
    );
    handler = mod.handler;
  });

  afterAll(async () => {
    await deleteAllTables();
  });

  beforeEach(async () => {
    await clearTable(TABLE_NAMES.products);
  });

  describe("POST /products", () => {
    it("should create a new product and return its ID", async () => {
      const event = createApiGatewayEvent({
        httpMethod: "POST",
        path: "/products",
        resource: "/products",
        body: JSON.stringify({
          name: "Pro Plan",
          description: "Full access subscription",
          type: "subscription",
          entitlements: ["subject_access"],
          isActive: true,
        }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.productId).toBeDefined();
    });
  });

  describe("GET /products", () => {
    beforeEach(async () => {
      await handler(
        createApiGatewayEvent({
          httpMethod: "POST",
          path: "/products",
          resource: "/products",
          body: JSON.stringify({
            name: "Basic Plan",
            type: "subscription",
            entitlements: ["subject_access"],
            isActive: true,
          }),
        })
      );
    });

    it("should list products", async () => {
      const event = createApiGatewayEvent({
        httpMethod: "GET",
        path: "/products",
        resource: "/products",
        queryStringParameters: { type: "subscription" },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("GET /products/{id}", () => {
    it("should get a product by ID", async () => {
      const createRes = await handler(
        createApiGatewayEvent({
          httpMethod: "POST",
          path: "/products",
          resource: "/products",
          body: JSON.stringify({
            name: "Lookup Plan",
            type: "subscription",
            entitlements: ["subject_access"],
            isActive: true,
          }),
        })
      );

      const productId = JSON.parse(createRes.body).productId;

      const event = createApiGatewayEvent({
        httpMethod: "GET",
        path: `/products/${productId}`,
        resource: "/products/{id}",
        pathParameters: { id: productId },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.productId).toBe(productId);
      expect(body.name).toBe("Lookup Plan");
    });

    it("should return 404 for non-existent product", async () => {
      const event = createApiGatewayEvent({
        httpMethod: "GET",
        path: "/products/nonexistent-id",
        resource: "/products/{id}",
        pathParameters: { id: "nonexistent-id" },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(404);
    });
  });

  describe("DELETE /products/{id}", () => {
    it("should delete a product", async () => {
      const createRes = await handler(
        createApiGatewayEvent({
          httpMethod: "POST",
          path: "/products",
          resource: "/products",
          body: JSON.stringify({
            name: "Delete Me",
            type: "one_off",
            entitlements: ["subject_access"],
            isActive: true,
          }),
        })
      );

      const productId = JSON.parse(createRes.body).productId;

      const deleteEvent = createApiGatewayEvent({
        httpMethod: "DELETE",
        path: `/products/${productId}`,
        resource: "/products/{id}",
        pathParameters: { id: productId },
      });

      const result = await handler(deleteEvent);
      expect(result.statusCode).toBe(204);

      const getEvent = createApiGatewayEvent({
        httpMethod: "GET",
        path: `/products/${productId}`,
        resource: "/products/{id}",
        pathParameters: { id: productId },
      });

      const getResult = await handler(getEvent);
      expect(getResult.statusCode).toBe(404);
    });
  });

  describe("OPTIONS (CORS preflight)", () => {
    it("should return 204 with CORS headers", async () => {
      const event = createApiGatewayEvent({
        httpMethod: "OPTIONS",
        path: "/products",
        resource: "/products",
        body: null,
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(204);
    });
  });

  describe("404 handling", () => {
    it("should return 404 for unknown route", async () => {
      const event = createApiGatewayEvent({
        httpMethod: "GET",
        path: "/nonexistent",
        resource: "/nonexistent",
        body: null,
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(404);
    });
  });
});

import {
  createAllTables,
  deleteAllTables,
  clearTable,
  setTestEnvVars,
  TABLE_NAMES,
} from "../helpers/localstack";

import { DynamoProductRepository, ListProductsUseCase } from "@libs/domain";
import {
  seedProductsForListAndPaginationTests,
  seedProductsForByEntitlementTests,
} from "../helpers/product-service-seed";
import { ProductType } from "../../libs/domain/src/products/domain/value-objects/product-type.vo";

describe("Product listing integration tests", () => {
  let repo: DynamoProductRepository;
  let useCase: ListProductsUseCase;

  beforeAll(async () => {
    setTestEnvVars();
    await createAllTables();
    repo = new DynamoProductRepository();
    useCase = new ListProductsUseCase(repo);
  });

  beforeEach(async () => {
    await clearTable(TABLE_NAMES.products);
  });

  afterAll(async () => {
    await deleteAllTables();
  });

  it("returns all inactive products when isActive=false", async () => {
    await seedProductsForListAndPaginationTests();

    const result = await useCase.execute({
      pageNumber: 1,
      pageSize: 20,
      isActive: false,
    });

    expect(result.items.length).toBe(2); // currently only checks of type subscription
    result.items.forEach((product) => {
      expect(product.isActive).toBe(false);
    });
  });

  it("searches all product types when entitlementKey is provided without type", async () => {
    await seedProductsForByEntitlementTests();

    const result = await useCase.execute({
      pageNumber: 1,
      pageSize: 20,
      entitlementKey: "subject_access",
    });

    expect(result.items.length).toBeGreaterThanOrEqual(2);
    result.items.forEach((product) => {
      expect(product.entitlements).toContain("subject_access");
    });
  });

  it("preserves type filtering when type is provided", async () => {
    await seedProductsForListAndPaginationTests();

    const result = await useCase.execute({
      pageNumber: 1,
      pageSize: 20,
      type: ProductType.ADDON,
      isActive: true,
    });

    expect(result.items.length).toBeGreaterThan(0);
    result.items.forEach((product) => {
      expect(product.type).toBe("addon");
      expect(product.isActive).toBe(true);
    });
  });

  it("paginates correctly on filtered data", async () => {
    await seedProductsForListAndPaginationTests();

    const result = await useCase.execute({
      pageNumber: 2,
      pageSize: 3,
      isActive: true,
    });

    expect(result.items.length).toBeLessThanOrEqual(3);
    expect(result.pageNumber).toBe(2);
    expect(result.pageSize).toBe(3);
  });
});

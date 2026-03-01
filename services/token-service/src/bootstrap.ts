import {
  DynamoEntitlementRepository,
  DynamoPriceRepository,
  DynamoProductRepository,
  ProductRepositoryPorts,
  CreateEntitlementUseCase,
  SyncProductLimitsToEntitlementsUseCase,
} from "@libs/domain";
import { ChargeTokenUseCase } from "./app/usecases/charge.token.usecase";
import { ChargeTokenController } from "./app/controllers/charge.token.controller";

export function bootstrap() {
  const entitlementsTableName = process.env.ENTITLEMENTS_TABLE;
  const pricesTableName = process.env.PRICES_TABLE;
  const productsTableName = process.env.PRODUCTS_TABLE;

  if (!entitlementsTableName) {
    throw new Error("ENTITLEMENTS_TABLE environment variable is not set");
  }
  if (!pricesTableName) {
    throw new Error("PRICES_TABLE environment variable is not set");
  }
  if (!productsTableName) {
    throw new Error("PRODUCTS_TABLE environment variable is not set");
  }

  const entitlementRepo = new DynamoEntitlementRepository(entitlementsTableName);
  const priceRepo = new DynamoPriceRepository();
  const productRepo = new DynamoProductRepository();
  const createEntitlementUseCase = new CreateEntitlementUseCase(entitlementRepo);
  const syncProductLimitsUseCase = new SyncProductLimitsToEntitlementsUseCase(
    productRepo,
    entitlementRepo
  );

  const chargeTokenUseCase = new ChargeTokenUseCase(
    entitlementRepo,
    priceRepo,
    productRepo as ProductRepositoryPorts.ProductRepository,
    createEntitlementUseCase,
    syncProductLimitsUseCase
  );

  return {
    chargeTokenController: new ChargeTokenController(chargeTokenUseCase),
  };
}

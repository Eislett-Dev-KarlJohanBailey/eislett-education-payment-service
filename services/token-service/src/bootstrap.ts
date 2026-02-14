import {
  DynamoEntitlementRepository,
  DynamoPriceRepository,
  DynamoProductRepository,
  ProductRepositoryPorts,
} from "@libs/domain";
import { ChargeTokenUseCase } from "./app/usecases/charge.token.usecase";
import { ChargeTokenController } from "./app/controllers/charge.token.controller";
import { BillingEventPublisher } from "./infrastructure/event.publisher";

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
  const eventPublisher = new BillingEventPublisher();

  const chargeTokenUseCase = new ChargeTokenUseCase(
    entitlementRepo,
    priceRepo,
    productRepo as ProductRepositoryPorts.ProductRepository,
    eventPublisher
  );

  return {
    chargeTokenController: new ChargeTokenController(chargeTokenUseCase),
  };
}

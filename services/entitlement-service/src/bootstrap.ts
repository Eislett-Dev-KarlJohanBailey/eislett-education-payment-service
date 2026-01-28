import {
  DynamoEntitlementRepository,
  DynamoProductRepository,
  CreateEntitlementUseCase,
  SyncProductLimitsToEntitlementsUseCase,
  ProductRepositoryPorts,
  DynamoDunningRepository,
} from "@libs/domain";
import { ProcessBillingEventUseCase } from "./app/usecases/process.billing.event.usecase";
import { EntitlementEventPublisher } from "./infrastructure/event.publisher";

export function bootstrap() {
  const productsTableName = process.env.PRODUCTS_TABLE;
  const entitlementsTableName = process.env.ENTITLEMENTS_TABLE;
  const processedEventsTableName = process.env.PROCESSED_EVENTS_TABLE;
  const dunningTableName = process.env.DUNNING_TABLE; // Optional

  if (!productsTableName) {
    throw new Error("PRODUCTS_TABLE environment variable is not set");
  }
  if (!entitlementsTableName) {
    throw new Error("ENTITLEMENTS_TABLE environment variable is not set");
  }
  if (!processedEventsTableName) {
    throw new Error("PROCESSED_EVENTS_TABLE environment variable is not set");
  }

  const productRepo = new DynamoProductRepository();
  const entitlementRepo = new DynamoEntitlementRepository(entitlementsTableName);
  const createEntitlementUseCase = new CreateEntitlementUseCase(entitlementRepo);
  const syncProductLimitsUseCase = new SyncProductLimitsToEntitlementsUseCase(productRepo, entitlementRepo);
  const eventPublisher = new EntitlementEventPublisher();
  
  // Dunning repository is optional - only used to check state before revoking
  const dunningRepo = dunningTableName ? new DynamoDunningRepository(dunningTableName) : undefined;

  const processBillingEventUseCase = new ProcessBillingEventUseCase(
    createEntitlementUseCase,
    syncProductLimitsUseCase,
    eventPublisher,
    entitlementRepo,
    productRepo as ProductRepositoryPorts.ProductRepository,
    dunningRepo
  );

  return {
    processBillingEventUseCase
  };
}

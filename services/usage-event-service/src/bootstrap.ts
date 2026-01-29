import { DynamoEntitlementRepository } from "@libs/domain";
import { ProcessUsageEventUseCase } from "./app/usecases/process.usage.event.usecase";

export function bootstrap() {
  const entitlementsTableName = process.env.ENTITLEMENTS_TABLE;

  if (!entitlementsTableName) {
    throw new Error(
      "ENTITLEMENTS_TABLE environment variable is not set"
    );
  }

  const entitlementRepo = new DynamoEntitlementRepository(
    entitlementsTableName
  );
  const processUsageEventUseCase = new ProcessUsageEventUseCase(
    entitlementRepo
  );

  return {
    processUsageEventUseCase,
  };
}

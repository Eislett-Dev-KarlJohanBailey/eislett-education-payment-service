import { DynamoEntitlementRepository, type EntitlementUpdateNotifier } from "@libs/domain";
import { ProcessUsageEventUseCase } from "./app/usecases/process.usage.event.usecase";
import { EntitlementUpdatesPublisher } from "./infrastructure/entitlement-updates.publisher";

export function bootstrap() {
  const entitlementsTableName = process.env.ENTITLEMENTS_TABLE;

  if (!entitlementsTableName) {
    throw new Error(
      "ENTITLEMENTS_TABLE environment variable is not set"
    );
  }

  const entitlementRepo = new DynamoEntitlementRepository(entitlementsTableName);
  const entitlementUpdatesPublisher = new EntitlementUpdatesPublisher();
  const entitlementUpdateNotifier: EntitlementUpdateNotifier = {
    notify: (e) => entitlementUpdatesPublisher.publishFromEntitlement(e),
  };
  const processUsageEventUseCase = new ProcessUsageEventUseCase(
    entitlementRepo,
    entitlementUpdateNotifier
  );

  return {
    processUsageEventUseCase,
  };
}

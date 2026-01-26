import { DynamoEntitlementRepository, GetUserEntitlementsUseCase } from "@libs/domain";
import { GetUserEntitlementsController } from "./app/controllers/get.user.entitlements.controller";

export function bootstrap() {
  const entitlementsTableName = process.env.ENTITLEMENTS_TABLE;
  if (!entitlementsTableName) {
    throw new Error("ENTITLEMENTS_TABLE environment variable is not set");
  }

  const entitlementRepo = new DynamoEntitlementRepository(entitlementsTableName);

  return {
    getUserEntitlementsController: new GetUserEntitlementsController(
      new GetUserEntitlementsUseCase(entitlementRepo)
    )
  };
}

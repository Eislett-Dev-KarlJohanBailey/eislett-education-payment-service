import {
  DynamoDunningRepository,
} from "@libs/domain";
import { ProcessBillingEventUseCase } from "./app/usecases/process.billing.event.usecase";
import { GetBillingIssueUseCase } from "./app/usecases/get.billing.issue.usecase";
import { GetBillingIssueController } from "./app/controllers/get.billing.issue.controller";
import { EntitlementEventPublisher } from "./infrastructure/event.publisher";

export function bootstrap() {
  const dunningTableName = process.env.DUNNING_TABLE;
  const entitlementUpdatesTopicArn = process.env.ENTITLEMENT_UPDATES_TOPIC_ARN;

  if (!dunningTableName) {
    throw new Error("DUNNING_TABLE environment variable is not set");
  }
  if (!entitlementUpdatesTopicArn) {
    throw new Error("ENTITLEMENT_UPDATES_TOPIC_ARN environment variable is not set");
  }

  const dunningRepo = new DynamoDunningRepository(dunningTableName);
  const entitlementEventPublisher = new EntitlementEventPublisher();

  const processBillingEventUseCase = new ProcessBillingEventUseCase(
    dunningRepo,
    entitlementEventPublisher
  );

  const getBillingIssueUseCase = new GetBillingIssueUseCase(
    dunningRepo,
    entitlementEventPublisher
  );
  const getBillingIssueController = new GetBillingIssueController(getBillingIssueUseCase);

  return {
    processBillingEventUseCase,
    getBillingIssueUseCase,
    getBillingIssueController
  };
}

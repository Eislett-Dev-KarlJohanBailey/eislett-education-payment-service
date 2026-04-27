import { handler } from "../../services/entitlement-service/src/handler";

import {
  BillingEvent,
  DynamoEntitlementRepository,
  DynamoProductRepository,
  EntitlementKey,
} from "@libs/domain";
import { DynamoProcessedPaymentsRepository } from "../../services/entitlement-service/src/infrastructure/processed-payments.repository";
import {
  createAllTables,
  clearTable,
  createSnsTopic,
  createQueueSubscribedToSns,
  receiveOneMessageFromQueue,
  drainAllMessagesFromQueue,
  docClient,
  setTestEnvVars,
  TABLE_NAMES,
} from "../helpers/localstack";

import {
  createBillingDomainEvent,
  createBillingMeta,
} from "../helpers/billing";

import { createProduct } from "../helpers/product";
import { sqsEventFromBodies } from "../helpers/sqs";
import { isoDaysFromNow } from "../helpers/dates";
import { snsWrap } from "../helpers/sns";

const entitlementRepo = () =>
  new DynamoEntitlementRepository(TABLE_NAMES.entitlements, docClient());

const processedPaymentsRepo = () =>
  new DynamoProcessedPaymentsRepository(
    TABLE_NAMES.processedEvents,
    docClient(),
  );

let entitlementUpdatesTopicArn: string;
let entitlementUpdatesQueueUrl: string;

const USER_ID = "user-1";

const BASE_PRODUCT_ID = "prod-basic";
const ADDON_PRODUCT_ID = "addon-ai-credits";
const ONE_TIME_PRODUCT_ID = "one-time-ai-credits";

const QUESTION_ACCESS = EntitlementKey.QUESTION_GENERATION;
const AI_CREDITS = EntitlementKey.AI_TUTOR_ACCESS;

async function setupProducts(productRepo: DynamoProductRepository) {
  await createProduct(productRepo, [], {
    productId: BASE_PRODUCT_ID,
    entitlements: [QUESTION_ACCESS, AI_CREDITS],
    usageLimits: [
      {
        metric: AI_CREDITS,
        limit: 100,
        period: "billing_cycle",
      },
    ],
    addons: [ADDON_PRODUCT_ID],
  });

  await createProduct(productRepo, [], {
    productId: ADDON_PRODUCT_ID,
    entitlements: [AI_CREDITS],
    usageLimits: [
      {
        metric: AI_CREDITS,
        limit: 50,
        period: "billing_cycle",
      },
    ],
  });

  await createProduct(productRepo, [], {
    productId: ONE_TIME_PRODUCT_ID,
    entitlements: [AI_CREDITS],
    usageLimits: [
      {
        metric: AI_CREDITS,
        limit: 25,
        period: "lifetime",
      },
    ],
  });
}

describe("Entitlement Service End-to-End Flow", () => {
  let productRepo: DynamoProductRepository;

  beforeAll(async () => {
    await createAllTables();

    entitlementUpdatesTopicArn = await createSnsTopic(
      "entitlement-updates-test",
    );

    entitlementUpdatesQueueUrl = await createQueueSubscribedToSns(
      "entitlement-updates-test-queue",
      entitlementUpdatesTopicArn,
    );

    setTestEnvVars();
    process.env.ENTITLEMENT_UPDATES_TOPIC_ARN = entitlementUpdatesTopicArn;

    productRepo = new DynamoProductRepository();
  });

  beforeEach(async () => {
    await clearTable(TABLE_NAMES.products);
    await clearTable(TABLE_NAMES.entitlements);
    await clearTable(TABLE_NAMES.processedEvents, ["eventId"]);

    await drainAllMessagesFromQueue(entitlementUpdatesQueueUrl);

    await setupProducts(productRepo);
  });

  it("processes a billing event and creates an entitlement for a base product purchase", async () => {
    const billingEvent = createBillingDomainEvent(
      "subscription.created",
      {
        userId: USER_ID,
        productId: BASE_PRODUCT_ID,
        currentPeriodEnd: isoDaysFromNow(30),
      },
      createBillingMeta({
        eventId: "evt-sub-created-1",
        occurredAt: "2026-04-17T12:00:00.000Z",
      }),
    );

    const sqsEvent = sqsEventFromBodies([snsWrap(billingEvent)]);

    const result = await handler(sqsEvent);

    expect(result.batchItemFailures).toEqual([]);

    const questionAccess = await entitlementRepo().findByUserAndKey(
      USER_ID,
      QUESTION_ACCESS,
    );
    expect(questionAccess).toBeDefined();
    expect(questionAccess?.status).toBe("active");

    const aiCredits = await entitlementRepo().findByUserAndKey(
      USER_ID,
      AI_CREDITS,
    );
    expect(aiCredits).toBeDefined();
    expect(aiCredits?.usage).toBeDefined();
    expect(aiCredits?.usage?.limit).toBe(150);
  });
});

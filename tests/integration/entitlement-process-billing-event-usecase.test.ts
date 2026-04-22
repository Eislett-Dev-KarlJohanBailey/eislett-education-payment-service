import { jest } from "@jest/globals";
import {
  BillingEvent,
  CreateEntitlementUseCase,
  SyncProductLimitsToEntitlementsUseCase,
  DynamoProductRepository,
  DynamoEntitlementRepository,
  EntitlementKey,
} from "@libs/domain";
import { ProcessBillingEventUseCase } from "../../services/entitlement-service/src/app/usecases/process.billing.event.usecase";
import { EntitlementEventPublisher } from "../../services/entitlement-service/src/infrastructure/event.publisher";
import { DynamoProcessedPaymentsRepository } from "../../services/entitlement-service/src/infrastructure/processed-payments.repository";
import { createBillingDomainEvent } from "../helpers/billing";
import { isoDaysFromNow } from "../helpers/dates";
import { createProduct } from "../helpers/product";
import {
  createAllTables,
  deleteAllTables,
  clearTable,
  setTestEnvVars,
  TABLE_NAMES,
  docClient,
} from "../helpers/localstack";

type BillingDomainEvent<TPayload = any> =
  BillingEvent.BillingDomainEvent<TPayload>;

describe("ProcessBillingEventUseCase integration", () => {
  let productRepo!: DynamoProductRepository;
  let entitlementRepo!: DynamoEntitlementRepository;
  let processedPaymentsRepo!: DynamoProcessedPaymentsRepository;
  let useCase!: ProcessBillingEventUseCase;
  let eventPublisher!: EntitlementEventPublisher;

  const createdProductIds: string[] = [];

  beforeAll(async () => {
    await createAllTables();
    setTestEnvVars();

    productRepo = new DynamoProductRepository();
    entitlementRepo = new DynamoEntitlementRepository(
      TABLE_NAMES.entitlements,
      docClient(),
    );
    processedPaymentsRepo = new DynamoProcessedPaymentsRepository(
      TABLE_NAMES.processedEvents,
      docClient(),
    );

    eventPublisher = {
      publishCreated: jest.fn(async () => undefined),
      publishUpdated: jest.fn(async () => undefined),
      publishRevoked: jest.fn(async () => undefined),
      publishAvailabilityFromEntitlement: jest.fn(async () => undefined),
    } as unknown as EntitlementEventPublisher;

    const createEntitlementUseCase = new CreateEntitlementUseCase(
      entitlementRepo,
    );
    const syncProductLimitsUseCase = new SyncProductLimitsToEntitlementsUseCase(
      productRepo,
      entitlementRepo,
    );

    useCase = new ProcessBillingEventUseCase(
      createEntitlementUseCase,
      syncProductLimitsUseCase,
      eventPublisher,
      entitlementRepo,
      productRepo,
      undefined,
      processedPaymentsRepo,
    );
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await clearTable(TABLE_NAMES.entitlements);
    await clearTable(TABLE_NAMES.processedEvents, ["eventId"]);
  });

  afterEach(async () => {
    for (const productId of createdProductIds.splice(0)) {
      await productRepo.delete(productId);
    }
  });

  afterAll(async () => {
    await deleteAllTables();
  });

  it("should skip payment.failed events", async () => {
    await useCase.execute(
      createBillingDomainEvent("payment.failed", {
        userId: "user-1",
        productId: "prod-1",
      }),
    );

    expect(eventPublisher.publishCreated).not.toHaveBeenCalled();
    expect(eventPublisher.publishUpdated).not.toHaveBeenCalled();
    expect(eventPublisher.publishRevoked).not.toHaveBeenCalled();
  });

  it("should skip payment.action_required events", async () => {
    await useCase.execute(
      createBillingDomainEvent("payment.action_required", {
        userId: "user-1",
        productId: "prod-1",
      }),
    );

    expect(eventPublisher.publishCreated).not.toHaveBeenCalled();
    expect(eventPublisher.publishUpdated).not.toHaveBeenCalled();
    expect(eventPublisher.publishRevoked).not.toHaveBeenCalled();
  });

  it("should process subscription.created events", async () => {
    const userId = `user-${Date.now()}`;
    const productId = `prod-${Date.now()}`;
    const currentPeriodEnd = isoDaysFromNow(30);

    await createProduct(productRepo, createdProductIds, {
      productId,
      entitlements: [EntitlementKey.SUBJECT_ACCESS],
    });

    await useCase.execute(
      createBillingDomainEvent("subscription.created", {
        userId,
        productId,
        currentPeriodEnd,
        addonProductIds: [],
      }),
    );

    const entitlements = await entitlementRepo.findByUser(userId);

    expect(entitlements).toHaveLength(1);
    expect(entitlements[0].key).toBe(EntitlementKey.SUBJECT_ACCESS);
    expect(entitlements[0].expiresAt?.toISOString()).toBe(currentPeriodEnd);
    expect(eventPublisher.publishCreated).toHaveBeenCalled();
  });
});

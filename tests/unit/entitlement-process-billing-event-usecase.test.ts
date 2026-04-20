import {
  BillingEvent,
  CreateEntitlementUseCase,
  SyncProductLimitsToEntitlementsUseCase,
  EntitlementRepository,
  DunningRepository,
  ProductRepositoryPorts,
} from "@libs/domain";
import { ProcessBillingEventUseCase } from "../../services/entitlement-service/src/app/usecases/process.billing.event.usecase";
import { EntitlementEventPublisher } from "../../services/entitlement-service/src/infrastructure/event.publisher";
import { ProcessedPaymentsRepository } from "../../services/entitlement-service/src/infrastructure/processed-payments.repository";
import { jest } from "@jest/globals";

type BillingDomainEvent<TPayload = any> =
  BillingEvent.BillingDomainEvent<TPayload>;
type BillingEventMetadata = BillingEvent.BillingEventMetadata;

type MockProduct = {
  entitlements: string[];
  addonConfigs: any[];
  addons: any[];
};

function createBillingMeta(
  meta: Partial<BillingEventMetadata> = {},
): BillingEventMetadata {
  return {
    eventId: "evt-1",
    occurredAt: "2026-04-19T12:00:00.000Z",
    source: "internal",
    ...meta,
  };
}

function createBillingDomainEvent<TPayload>(
  type: string,
  payload: TPayload,
  meta: BillingEventMetadata = createBillingMeta(),
): BillingDomainEvent<TPayload> {
  return {
    type,
    payload,
    meta,
    version: 1,
  } as BillingDomainEvent<TPayload>;
}

function makeMockBillingEventUseCase() {
  const createEntitlementUseCase = {
    execute: jest.fn(),
  } as unknown as CreateEntitlementUseCase;

  const syncProductLimitsUseCase = {
    execute: jest.fn(),
  } as unknown as SyncProductLimitsToEntitlementsUseCase;

  const eventPublisher = {
    publishCreated: jest.fn(),
    publishUpdated: jest.fn(),
    publishRevoked: jest.fn(),
    publishAvailabilityFromEntitlement: jest.fn(),
  } as unknown as EntitlementEventPublisher;

  const entitlementRepo = {
    findByUser: jest.fn(),
    findByUserAndKey: jest.fn(),
    update: jest.fn(),
    save: jest.fn(),
    deleteAll: jest.fn(),
    deleteByUserAndKey: jest.fn(),
  } as unknown as EntitlementRepository;

  const productRepo = {
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    list: jest.fn(),
  } as unknown as ProductRepositoryPorts.ProductRepository;

  const dunningRepo = {
    findByUserId: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  } as unknown as DunningRepository;

  const processedPaymentsRepo = {
    isPaymentProcessed: jest.fn(),
    markPaymentProcessed: jest.fn(),
  } as unknown as ProcessedPaymentsRepository;

  const useCase = new ProcessBillingEventUseCase(
    createEntitlementUseCase,
    syncProductLimitsUseCase,
    eventPublisher,
    entitlementRepo,
    productRepo,
    dunningRepo,
    processedPaymentsRepo,
  );

  return {
    useCase,
    mocks: {
      createEntitlementUseCase,
      syncProductLimitsUseCase,
      eventPublisher,
      entitlementRepo,
      productRepo,
      dunningRepo,
      processedPaymentsRepo,
    },
  };
}

describe("entitlement-service processBillingEventUseCase", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should skip payment.failed events", async () => {
    const { useCase, mocks } = makeMockBillingEventUseCase();

    await useCase.execute(
      createBillingDomainEvent("payment.failed", {
        userId: "user-1",
        productId: "prod-1",
      }),
    );

    expect(mocks.createEntitlementUseCase.execute).not.toHaveBeenCalled();
    expect(mocks.syncProductLimitsUseCase.execute).not.toHaveBeenCalled();
    expect(mocks.eventPublisher.publishCreated).not.toHaveBeenCalled();
    expect(mocks.eventPublisher.publishUpdated).not.toHaveBeenCalled();
    expect(mocks.eventPublisher.publishRevoked).not.toHaveBeenCalled();
  });

  it("should skip payment.action_required events", async () => {
    const { useCase, mocks } = makeMockBillingEventUseCase();

    await useCase.execute(
      createBillingDomainEvent("payment.action_required", {
        userId: "user-1",
        productId: "prod-1",
      }),
    );

    expect(mocks.createEntitlementUseCase.execute).not.toHaveBeenCalled();
    expect(mocks.syncProductLimitsUseCase.execute).not.toHaveBeenCalled();
    expect(mocks.eventPublisher.publishCreated).not.toHaveBeenCalled();
    expect(mocks.eventPublisher.publishUpdated).not.toHaveBeenCalled();
    expect(mocks.eventPublisher.publishRevoked).not.toHaveBeenCalled();
  });

  it("should process subscription.created events", async () => {
    const { useCase, mocks } = makeMockBillingEventUseCase();

    (mocks.productRepo.findById as jest.Mock).mockImplementation(async () => ({
      // using this to return product details for entitlement creation
      entitlements: ["subject_access"],
      addonConfigs: [],
      addons: [],
    }));

    (mocks.entitlementRepo.findByUser as jest.Mock).mockImplementation(
      async () => [
        {
          // entitlement created by usecase for subscription.created event
          userId: "user-1",
          key: "subject_access",
          role: "learner",
          status: "active",
          expiresAt: new Date("2026-05-19T12:00:00.000Z"),
          usage: undefined,
        },
      ],
    );

    (mocks.entitlementRepo.findByUser as jest.Mock).mockImplementation(
      // checking existing entitlements for the user
      async () => [
        {
          // returning an exisiting entitlement
          userId: "user-1",
          key: "subject_access",
          role: "learner",
          status: "active",
          expiresAt: new Date("2026-05-19T12:00:00.000Z"),
          usage: undefined,
        },
      ],
    );

    (mocks.createEntitlementUseCase.execute as jest.Mock).mockImplementation(
      async () => undefined, // mocking create
    );
    (mocks.syncProductLimitsUseCase.execute as jest.Mock).mockImplementation(
      async () => undefined,
    );
    (mocks.eventPublisher.publishCreated as jest.Mock).mockImplementation(
      async () => undefined,
    );

    await useCase.execute(
      createBillingDomainEvent("subscription.created", {
        userId: "user-1",
        productId: "prod-1",
        currentPeriodEnd: "2026-05-19T12:00:00.000Z",
        addonProductIds: [],
      }),
    );

    expect(mocks.createEntitlementUseCase.execute).toHaveBeenCalled();
    expect(mocks.syncProductLimitsUseCase.execute).toHaveBeenCalled();
    expect(mocks.eventPublisher.publishCreated).toHaveBeenCalled();
  });
});

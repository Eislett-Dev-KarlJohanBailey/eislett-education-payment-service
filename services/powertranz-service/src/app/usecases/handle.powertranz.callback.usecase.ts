import {
  BillingEvent,
  CreateEntitlementUseCase,
  SyncProductLimitsToEntitlementsUseCase,
  EntitlementRepository,
  ProductRepositoryPorts,
} from "@libs/domain";

export interface HandlePowerTranzCallbackInput {
  spiToken: string;
  status: "success" | "failed";
  transactionId?: string;
  rawPayload: unknown;
}

export class HandlePowerTranzCallbackUseCase {
  constructor(
    private readonly powerTranzClient: PowerTranzClient,
    private readonly paymentIntentRepo: PowerTranzPaymentIntentRepository,
    private readonly createEntitlementUseCase: CreateEntitlementUseCase,
    private readonly syncProductLimitsUseCase: SyncProductLimitsToEntitlementsUseCase,
    private readonly entitlementRepo: EntitlementRepository,
    private readonly productRepo: ProductRepositoryPorts.ProductRepository,
  ) {}

  async execute(input: HandlePowerTranzCallbackInput): Promise<void> {
    const intent = await this.paymentIntentRepo.findBySpiToken(input.spiToken);

    if (!intent) {
      throw new Error("Payment intent not found");
    }

    if (intent.status === "completed" || intent.status === "failed") {
      // idempotency check - if we've already processed this callback, do nothing
      return;
    }
  }
}

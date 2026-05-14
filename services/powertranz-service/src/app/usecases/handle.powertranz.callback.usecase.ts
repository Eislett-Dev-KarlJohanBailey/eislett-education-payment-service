import {
  BillingEvent,
  CreateEntitlementUseCase,
  SyncProductLimitsToEntitlementsUseCase,
  EntitlementRepository,
  ProductRepositoryPorts,
} from "@libs/domain";
import { PowerTranzIntentRepository } from "../../infrastructure/powertranz.intent.repository";
import { PowerTranzClient } from "../../infrastructure/powertranz.client";

export interface HandlePowerTranzCallbackInput {
  spiToken: string;
  rawPayload: Record<string, unknown>;
}

export class HandlePowerTranzCallbackUseCase {
  constructor(
    private readonly powerTranzClient: PowerTranzClient,
    private readonly paymentIntentRepo: PowerTranzIntentRepository,
  ) {}

  async execute(input: HandlePowerTranzCallbackInput): Promise<void> {
    const intent = await this.paymentIntentRepo.findBySpiToken(input.spiToken);

    if (!intent) {
      return;
    }

    if (intent.status === "completed" || intent.status === "failed") {
      // idempotency check - if we've already processed this callback, do nothing
      return;
    }

    const paymentResult = await this.powerTranzClient.chargePayment(
      input.spiToken,
    );

    const iso = String((paymentResult as any)?.IsoResponseCode ?? ""); // checks if payment was approved, "00" means approved in PowerTranz
    const approved = iso === "00";

    if (!approved) {
      await this.paymentIntentRepo.updateById(intent.id, {
        status: "failed",
      });
      return;
    }

    await this.paymentIntentRepo.updateById(intent.id, {
      status: "completed",
      transactionId: String(
        (paymentResult as any)?.TransactionIdentifier ?? "",
      ),
    });
  }
}

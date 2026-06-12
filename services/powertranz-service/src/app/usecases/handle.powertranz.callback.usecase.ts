import { BillingEvent, Transaction, TransactionRepository } from "@libs/domain";
import { PowerTranzIntentRepository } from "../../infrastructure/powertranz.intent.repository";
import { PowerTranzClient } from "../../infrastructure/powertranz.client";
import {
  PowerTranzBillingEventPublisher,
  PowerTranzEmailQueue,
} from "../../infrastructure/powertranz.callback.effects";
import { randomUUID } from "node:crypto";

export interface HandlePowerTranzCallbackInput {
  spiToken: string;
  rawPayload: Record<string, unknown>;
}

export interface HandlePowerTranzCallbackOutput {
  status: "success" | "cancel";
}

export class HandlePowerTranzCallbackUseCase {
  constructor(
    private readonly powerTranzClient: PowerTranzClient,
    private readonly paymentIntentRepo: PowerTranzIntentRepository,
    private readonly emailQueue: PowerTranzEmailQueue,
    private readonly billingEventPublisher: PowerTranzBillingEventPublisher,
    private readonly transactionRepo: TransactionRepository,
  ) {}

  async execute(
    input: HandlePowerTranzCallbackInput,
  ): Promise<HandlePowerTranzCallbackOutput> {
    const intent = await this.paymentIntentRepo.findBySpiToken(input.spiToken);

    if (!intent) {
      return { status: "cancel" };
    }

    if (intent.status === "completed") {
      // idempotency check - if we've already processed this callback, do nothing
      return { status: "success" };
    }

    if (intent.status === "failed") {
      return { status: "cancel" };
    }

    const riskManagement = input.rawPayload.RiskManagement as
      | Record<string, unknown>
      | undefined;

    const threeDSecure = riskManagement?.["ThreeDSecure"] as
      | Record<string, unknown>
      | undefined;

    const authStatus = String(
      input.rawPayload.AuthenticationStatus ??
        threeDSecure?.AuthenticationStatus ??
        "",
    )
      .trim()
      .toUpperCase();

    const authIso = String(
      input.rawPayload.IsoResponseCode ?? threeDSecure?.ResponseCode ?? "",
    )
      .trim()
      .toUpperCase();

    const hasThreeDsSignal = authStatus.length > 0 || authIso.length > 0;
    const threeDsApproved =
      authIso === "HP0" || (authStatus === "Y" && authIso === "3D0");

    if (hasThreeDsSignal && !threeDsApproved) {
      await this.paymentIntentRepo.updateBySpiToken(intent.spiToken, {
        status: "failed",
      });

      if (intent.userEmail) {
        await this.emailQueue.send({
          template: "payment-failed.hbs",
          header: "Payment failed",
          to: intent.userEmail,
          content: {
            amount: intent.amount,
            currency: intent.currency,
            priceId: intent.priceId,
            productId: intent.productId,
            failureReason: "3DS authentication failed",
          },
        });
      }

      return { status: "cancel" };
    }

    let paymentResult: unknown;

    try {
      // The browser return only proves 3DS finished. This server call is what
      // asks PowerTranz to finalize the Sale and submit it for settlement.
      paymentResult = await this.powerTranzClient.chargePayment(input.spiToken);
    } catch (error) {
      await this.paymentIntentRepo.updateBySpiToken(intent.spiToken, {
        status: "failed",
      });

      if (intent.userEmail) {
        await this.emailQueue.send({
          template: "payment-failed.hbs",
          header: "Payment failed",
          to: intent.userEmail,
          content: {
            amount: intent.amount,
            currency: intent.currency,
            priceId: intent.priceId,
            productId: intent.productId,
            failureReason:
              error instanceof Error ? error.message : "PowerTranz failed",
          },
        });
      }

      return { status: "cancel" };
    }

    const iso = String(
      (paymentResult as { IsoResponseCode?: string }).IsoResponseCode ?? "",
    ); // checks if payment was approved, "00" means approved in PowerTranz

    if (iso !== "00") {
      await this.paymentIntentRepo.updateBySpiToken(intent.spiToken, {
        status: "failed",
      });

      if (intent.userEmail) {
        await this.emailQueue.send({
          template: "payment-failed.hbs",
          header: "Payment failed",
          to: intent.userEmail,
          content: {
            amount: intent.amount,
            currency: intent.currency,
            priceId: intent.priceId,
            productId: intent.productId,
            failureCode: iso,
            failureReason: String(
              (paymentResult as { ResponseMessage?: string }).ResponseMessage ??
                "Payment failed",
            ),
          },
        });
      }

      return { status: "cancel" };
    }

    const transactionId =
      String(
        (paymentResult as { TransactionIdentifier?: string })
          .TransactionIdentifier ?? "",
      ).trim() || input.spiToken;

    await this.paymentIntentRepo.updateBySpiToken(intent.spiToken, {
      status: "completed",
      transactionId,
    });

    const billingEvent: BillingEvent.PaymentSuccessfulEvent = {
      type: BillingEvent.PaymentEventType.PAYMENT_SUCCESSFUL,
      version: 1,
      meta: {
        eventId: randomUUID(),
        occurredAt: new Date().toISOString(),
        source: "powertranz",
      },
      payload: {
        paymentIntentId: intent.id,
        userId: intent.userId,
        amount: intent.amount,
        currency: intent.currency,
        priceId: intent.priceId,
        productId: intent.productId,
        provider: "powertranz",
        billingType: "one_time",
      },
    };

    const transaction = Transaction.fromBillingEvent(
      billingEvent.type,
      billingEvent.payload,
      billingEvent.meta.eventId,
    );

    await this.transactionRepo.save(transaction);
    await this.billingEventPublisher.publish(billingEvent);

    if (intent.userEmail) {
      await this.emailQueue.send({
        template: "payment-successful.hbs",
        header: "Payment successful",
        to: intent.userEmail,
        content: {
          amount: intent.amount,
          currency: intent.currency,
          priceId: intent.priceId,
          productId: intent.productId,
          transactionId: transaction.transactionId,
        },
      });
    }

    return { status: "success" };
  }
}

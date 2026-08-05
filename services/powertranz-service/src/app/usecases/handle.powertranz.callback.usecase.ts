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
  spiToken: string;
  transactionId?: string;
  orderIdentifier?: string;
}

export class HandlePowerTranzCallbackUseCase {
  constructor(
    private readonly powerTranzClient: PowerTranzClient,
    private readonly paymentIntentRepo: PowerTranzIntentRepository,
    private readonly emailQueue: PowerTranzEmailQueue,
    private readonly billingEventPublisher: PowerTranzBillingEventPublisher,
    private readonly transactionRepo: TransactionRepository,
  ) {}

  private stringValue(value: unknown): string | undefined {
    const normalized = String(value ?? "").trim();
    return normalized ? normalized : undefined;
  }

  private numberValue(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
  }

  private detailsPatch(source: Record<string, unknown>, at: string) {
    const errors = Array.isArray(source.Errors)
      ? (source.Errors as Array<Record<string, unknown>>)
      : [];
    const firstError = errors[0];

    return {
      lastCallbackAt: at,
      transactionId: this.stringValue(source.TransactionIdentifier),
      orderIdentifier: this.stringValue(source.OrderIdentifier),
      approved:
        typeof source.Approved === "boolean"
          ? (source.Approved as boolean)
          : undefined,
      isoResponseCode: this.stringValue(source.IsoResponseCode),
      responseMessage: this.stringValue(source.ResponseMessage),
      cardBrand: this.stringValue(source.CardBrand),
      transactionType: this.numberValue(source.TransactionType),
      lastErrorCode: this.stringValue(firstError?.Code),
      lastErrorMessage: this.stringValue(firstError?.Message),
    };
  }

  async execute(
    input: HandlePowerTranzCallbackInput,
  ): Promise<HandlePowerTranzCallbackOutput> {
    const intent = await this.paymentIntentRepo.findBySpiToken(input.spiToken);

    if (!intent) {
      return { status: "cancel", spiToken: input.spiToken };
    }

    if (intent.status === "completed") {
      // idempotency check - if we've already processed this callback, do nothing
      return {
        status: "success",
        spiToken: intent.spiToken,
        transactionId: intent.transactionId,
        orderIdentifier: intent.orderIdentifier,
      };
    }

    if (intent.status === "failed") {
      return {
        status: "cancel",
        spiToken: intent.spiToken,
        transactionId: intent.transactionId,
        orderIdentifier: intent.orderIdentifier,
      };
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
    const callbackAt = new Date().toISOString();

    if (hasThreeDsSignal && !threeDsApproved) {
      await this.paymentIntentRepo.updateBySpiToken(intent.spiToken, {
        ...this.detailsPatch(input.rawPayload, callbackAt),
        status: "failed",
        failedAt: callbackAt,
        approved: false,
        responseMessage:
          this.stringValue(input.rawPayload.ResponseMessage) ??
          "3DS authentication failed",
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

      return {
        status: "cancel",
        spiToken: intent.spiToken,
        transactionId:
          this.stringValue(input.rawPayload.TransactionIdentifier) ??
          intent.transactionId,
        orderIdentifier:
          this.stringValue(input.rawPayload.OrderIdentifier) ??
          intent.orderIdentifier,
      };
    }

    let paymentResult: unknown;

    try {
      // The browser return only proves the hosted-page / 3DS flow finished.
      // We still need to complete the SPI payment server-side.
      paymentResult = await this.powerTranzClient.chargePayment(input.spiToken);
    } catch (error) {
      await this.paymentIntentRepo.updateBySpiToken(intent.spiToken, {
        ...this.detailsPatch(input.rawPayload, callbackAt),
        status: "failed",
        failedAt: callbackAt,
        approved: false,
        responseMessage:
          error instanceof Error ? error.message : "PowerTranz failed",
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

      return {
        status: "cancel",
        spiToken: intent.spiToken,
        transactionId:
          this.stringValue(input.rawPayload.TransactionIdentifier) ??
          intent.transactionId,
        orderIdentifier:
          this.stringValue(input.rawPayload.OrderIdentifier) ??
          intent.orderIdentifier,
      };
    }

    const iso = String(
      (paymentResult as { IsoResponseCode?: string }).IsoResponseCode ?? "",
    ); // checks if payment was approved, "00" means approved in PowerTranz
    const paymentDetails = this.detailsPatch(
      paymentResult as Record<string, unknown>,
      callbackAt,
    );

    if (iso !== "00") {
      await this.paymentIntentRepo.updateBySpiToken(intent.spiToken, {
        ...paymentDetails,
        status: "failed",
        failedAt: callbackAt,
        approved: false,
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

      return {
        status: "cancel",
        spiToken: intent.spiToken,
        transactionId: paymentDetails.transactionId ?? intent.transactionId,
        orderIdentifier: paymentDetails.orderIdentifier ?? intent.orderIdentifier,
      };
    }

    const transactionId =
      String(
        (paymentResult as { TransactionIdentifier?: string })
          .TransactionIdentifier ?? "",
      ).trim() || input.spiToken;

    const captureResult = await this.powerTranzClient.capturePayment({
      TransactionIdentifier: transactionId,
      TotalAmount: Number(
        (paymentResult as { TotalAmount?: number }).TotalAmount ?? intent.amount,
      ),
      CurrencyCode:
        String(
          (paymentResult as { CurrencyCode?: string }).CurrencyCode ?? "",
        ).trim() || "840",
    });

    const captureIso = String(
      (captureResult as { IsoResponseCode?: string }).IsoResponseCode ?? "",
    ).trim();
    const captureDetails = this.detailsPatch(
      captureResult as Record<string, unknown>,
      callbackAt,
    );

    if (captureIso !== "00") {
      await this.paymentIntentRepo.updateBySpiToken(intent.spiToken, {
        ...captureDetails,
        status: "failed",
        failedAt: callbackAt,
        approved: false,
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
            failureCode: captureIso,
            failureReason: String(
              (captureResult as { ResponseMessage?: string }).ResponseMessage ??
                "Capture failed",
            ),
          },
        });
      }

      return {
        status: "cancel",
        spiToken: intent.spiToken,
        transactionId: captureDetails.transactionId ?? transactionId,
        orderIdentifier: captureDetails.orderIdentifier ?? intent.orderIdentifier,
      };
    }

    await this.paymentIntentRepo.updateBySpiToken(intent.spiToken, {
      ...captureDetails,
      status: "completed",
      paidAt: callbackAt,
      approved: true,
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

    return {
      status: "success",
      spiToken: intent.spiToken,
      transactionId: captureDetails.transactionId ?? transactionId,
      orderIdentifier: captureDetails.orderIdentifier ?? intent.orderIdentifier,
    };
  }
}

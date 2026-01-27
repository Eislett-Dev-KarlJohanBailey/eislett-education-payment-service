import { BillingDomainEvent } from "../base/domain-event";
import { PaymentEventType } from "./payment-event.type";
import { PaymentPayload } from "./payment.types";

export type PaymentFailedEvent = BillingDomainEvent<PaymentPayload> & {
  type: PaymentEventType.PAYMENT_FAILED;
};

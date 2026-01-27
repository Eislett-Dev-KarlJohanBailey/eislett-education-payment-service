import { BillingDomainEvent } from "../base/domain-event";
import { PaymentEventType } from "./payment-event.type";
import { PaymentPayload } from "./payment.types";

export type PaymentActionRequiredEvent = BillingDomainEvent<PaymentPayload> & {
  type: PaymentEventType.PAYMENT_ACTION_REQUIRED;
};

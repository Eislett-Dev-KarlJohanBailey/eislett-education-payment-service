import { BillingDomainEvent } from "../base/domain-event";
import { SubscriptionEventType } from "./subscription-event.type";
import { SubscriptionPayload } from "./subscription.types";

export type SubscriptionPausedEvent = BillingDomainEvent<SubscriptionPayload> & {
  type: SubscriptionEventType.SUBSCRIPTION_PAUSED;
};

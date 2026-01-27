import { BillingDomainEvent } from "../base/domain-event";
import { EntitlementEventType } from "./entitlement-event.type";
import { EntitlementEventPayload } from "./entitlement.types";

export type EntitlementCreatedEvent = BillingDomainEvent<EntitlementEventPayload> & {
  type: EntitlementEventType.ENTITLEMENT_CREATED;
};

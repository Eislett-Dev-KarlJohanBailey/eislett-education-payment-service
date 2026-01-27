import { BillingDomainEvent } from "../base/domain-event";
import { EntitlementEventType } from "./entitlement-event.type";
import { EntitlementEventPayload } from "./entitlement.types";

export type EntitlementRevokedEvent = BillingDomainEvent<EntitlementEventPayload> & {
  type: EntitlementEventType.ENTITLEMENT_REVOKED;
};

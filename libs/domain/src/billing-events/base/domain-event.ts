import { BillingEventMetadata } from "./event-metadata";

export interface BillingDomainEvent<TPayload = unknown> {
  /** Canonical event name */
  type: string;

  /** Event payload */
  payload: TPayload;

  /** Metadata for tracing & routing */
  meta: BillingEventMetadata;

  /** Schema version */
  version: number;
}

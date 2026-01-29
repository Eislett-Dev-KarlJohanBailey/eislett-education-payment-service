/**
 * Payload for an entitlement usage event.
 * Sent to the usage-event-service SQS queue to record consumption against an entitlement.
 */
export interface UsageEventPayload {
  /** User who consumed the entitlement */
  userId: string;
  /** Entitlement key (e.g. ACCESS_DASHBOARD, AI_TUTOR_ACCESS) */
  entitlementKey: string;
  /** Amount of usage to record (default 1) */
  amount?: number;
  /** Optional idempotency key to avoid double-counting the same usage */
  idempotencyKey?: string;
  /** Optional metadata (e.g. resourceId, feature) */
  metadata?: Record<string, unknown>;
}

/**
 * Validated usage event for processing.
 */
export interface UsageDomainEvent {
  userId: string;
  entitlementKey: string;
  amount: number;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

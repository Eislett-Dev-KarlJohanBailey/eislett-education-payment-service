export interface BillingEventMetadata {
    eventId: string;
    occurredAt: string; // ISO timestamp
    source: "stripe" | "powertranz" | "internal";
    correlationId?: string;
  }
  
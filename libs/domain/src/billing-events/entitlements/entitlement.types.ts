export interface EntitlementEventPayload {
  userId: string;
  entitlementKey: string;
  role?: string;
  status: "active" | "inactive";
  expiresAt?: string; // ISO timestamp
  usageLimit?: {
    limit: number;
    used: number;
  };
  productId?: string;
  subscriptionId?: string;
  reason: string; // e.g., "subscription.created", "subscription.canceled", "addon.added"
}

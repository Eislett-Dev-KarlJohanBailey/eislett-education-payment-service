export interface SubscriptionPayload {
    subscriptionId: string;
    userId: string;
  
    productId: string;
    priceId: string;
  
    status: "active" | "paused" | "canceled" | "expired" | "trialing" | "past_due";
  
    currentPeriodStart: string;
    currentPeriodEnd: string;
  
    cancelAtPeriodEnd?: boolean;
  }
  
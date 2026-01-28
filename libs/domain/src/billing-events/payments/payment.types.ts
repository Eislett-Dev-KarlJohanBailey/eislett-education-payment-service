export interface PaymentPayload {
    paymentIntentId: string;
    userId: string;
  
    amount: number;
    currency: string;
  
    priceId: string;
    productId?: string;
    subscriptionId?: string;
  
    provider: "stripe" | "powertranz";
  
    failureCode?: string;
    failureReason?: string;
    
    portalUrl?: string; // Stripe Customer Portal URL for resolving billing issues
    expiresAt?: string; // ISO 8601 timestamp when the payment/action expires
  }
  
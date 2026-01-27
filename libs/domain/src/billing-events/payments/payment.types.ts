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
  }
  
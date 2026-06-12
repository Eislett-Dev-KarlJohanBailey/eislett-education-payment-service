export type PowerTranzIntentStatus =
  | "pending_payment"
  | "completed"
  | "failed"
  | "expired";

export interface PowerTranzPaymentIntent {
  id: string;
  userId: string;
  userEmail?: string;
  priceId: string;
  productId: string;
  spiToken: string;
  amount: number;
  currency: string;
  status: PowerTranzIntentStatus;
  expiresAt: string;
  createdAt: string;
  orderIdentifier?: string;
  transactionId?: string;
}

export interface PowerTranzIntentRepository {
  save(intent: PowerTranzPaymentIntent): Promise<void>;
  findBySpiToken(spiToken: string): Promise<PowerTranzPaymentIntent | null>;
  updateBySpiToken(
    spiToken: string,
    patch: Partial<PowerTranzPaymentIntent>,
  ): Promise<void>;
}

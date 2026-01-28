import { BillingEvent } from "@libs/domain";
import { TransactionRepository, Transaction } from "@libs/domain";

export class ProcessBillingEventUseCase {
  constructor(
    private readonly transactionRepo: TransactionRepository
  ) {}

  async execute(event: BillingEvent.BillingDomainEvent<any>): Promise<void> {
    // Map billing event type to transaction type
    const transactionType = this.mapEventTypeToTransactionType(event.type);
    
    if (!transactionType) {
      console.log(`Skipping event type ${event.type} - not a transaction event`);
      return;
    }

    // Create transaction from billing event
    const transaction = Transaction.fromBillingEvent(
      transactionType,
      event.payload,
      event.meta.eventId
    );

    // Save transaction
    await this.transactionRepo.save(transaction);
    console.log(`Recorded transaction: ${transaction.transactionId} (${transaction.type}) for user ${transaction.userId}`);
  }

  private mapEventTypeToTransactionType(
    eventType: string
  ): Transaction["type"] | null {
    switch (eventType) {
      case "payment.successful":
        return "payment.successful";
      case "payment.failed":
        return "payment.failed";
      case "payment.action_required":
        return "payment.action_required";
      case "subscription.created":
        return "subscription.created";
      case "subscription.updated":
        return "subscription.updated";
      case "subscription.canceled":
        return "subscription.canceled";
      case "subscription.expired":
        return "subscription.expired";
      default:
        return null;
    }
  }
}

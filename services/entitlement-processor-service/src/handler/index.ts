import { SQSEvent, SQSBatchResponse, SQSBatchItemFailure } from "aws-lambda";
import { parseSqsEvent } from "./sqs/parse-event";
import { bootstrap } from "../bootstrap";

export const handler = async (
  event: SQSEvent
): Promise<SQSBatchResponse> => {
  const { processBillingEventUseCase } = bootstrap();
  const batchItemFailures: SQSBatchItemFailure[] = [];

  try {
    // Parse SQS events to billing domain events
    const billingEvents = parseSqsEvent(event);

    // Process each event
    for (let i = 0; i < billingEvents.length; i++) {
      const billingEvent = billingEvents[i];
      const sqsRecord = event.Records[i];

      try {
        // Check idempotency (TODO: implement processed events check)
        // For now, we'll process all events
        // In the future, check PROCESSED_EVENTS_TABLE before processing

        // Process the billing event
        await processBillingEventUseCase.execute(billingEvent);

        console.log(`Successfully processed event: ${billingEvent.type} (${billingEvent.meta.eventId})`);
      } catch (error) {
        console.error(`Failed to process event ${billingEvent.type} (${billingEvent.meta.eventId}):`, error);
        
        // Add to batch failures so SQS can retry
        batchItemFailures.push({
          itemIdentifier: sqsRecord.messageId
        });
      }
    }

    return {
      batchItemFailures
    };
  } catch (error) {
    console.error("Fatal error processing SQS batch:", error);
    
    // Mark all items as failed
    return {
      batchItemFailures: event.Records.map(record => ({
        itemIdentifier: record.messageId
      }))
    };
  }
};

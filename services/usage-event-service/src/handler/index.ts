import {
  SQSEvent,
  SQSBatchResponse,
  SQSBatchItemFailure,
} from "aws-lambda";
import { parseSqsEvent } from "./sqs/parse-event";
import { bootstrap } from "../bootstrap";

export const handler = async (
  event: SQSEvent
): Promise<SQSBatchResponse> => {
  const { processUsageEventUseCase } = bootstrap();
  const batchItemFailures: SQSBatchItemFailure[] = [];

  try {
    const usageEvents = parseSqsEvent(event);

    for (let i = 0; i < usageEvents.length; i++) {
      const usageEvent = usageEvents[i];
      const sqsRecord = event.Records[i];

      try {
        await processUsageEventUseCase.execute(usageEvent);
        console.log(
          `Processed usage event: ${usageEvent.entitlementKey} user=${usageEvent.userId} amount=${usageEvent.amount}`
        );
      } catch (error) {
        console.error(
          `Failed to process usage event ${usageEvent.entitlementKey} (user: ${usageEvent.userId}):`,
          error
        );
        batchItemFailures.push({
          itemIdentifier: sqsRecord.messageId,
        });
      }
    }

    return {
      batchItemFailures,
    };
  } catch (error) {
    console.error("Fatal error processing SQS batch:", error);
    return {
      batchItemFailures: event.Records.map((record) => ({
        itemIdentifier: record.messageId,
      })),
    };
  }
};

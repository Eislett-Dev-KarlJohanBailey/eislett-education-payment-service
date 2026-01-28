import { SQSEvent, SQSRecord } from "aws-lambda";
import { BillingEvent } from "@libs/domain";

export function parseSqsEvent(event: SQSEvent): BillingEvent.BillingDomainEvent<any>[] {
  return event.Records.map(record => parseSqsRecord(record));
}

export function parseSqsRecord(record: SQSRecord): BillingEvent.BillingDomainEvent<any> {
  // SQS messages from SNS contain the SNS message in the body
  let messageBody: any;
  
  try {
    messageBody = JSON.parse(record.body);
  } catch (error) {
    throw new Error(`Failed to parse SQS record body: ${error instanceof Error ? error.message : String(error)}`);
  }

  // If the message came from SNS, the actual event is in messageBody.Message
  let eventData: BillingEvent.BillingDomainEvent<any>;
  
  if (messageBody.Type === "Notification" && messageBody.Message) {
    // Message from SNS - parse the Message field
    try {
      eventData = JSON.parse(messageBody.Message);
    } catch (error) {
      throw new Error(`Failed to parse SNS message: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else {
    // Direct message (not from SNS)
    eventData = messageBody;
  }

  // Validate event structure
  if (!eventData.type || !eventData.payload || !eventData.meta) {
    throw new Error(`Invalid billing event structure: missing required fields`);
  }

  return eventData;
}

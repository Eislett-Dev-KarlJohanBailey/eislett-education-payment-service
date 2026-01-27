import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { BillingEvent } from "@libs/domain";

type BillingDomainEvent<T = any> = BillingEvent.BillingDomainEvent<T>;
type BillingEventMetadata = BillingEvent.BillingEventMetadata;

export class BillingEventPublisher {
  private readonly topicArn: string;
  private readonly client: SNSClient;

  constructor() {
    const topicArn = process.env.BILLING_EVENTS_TOPIC_ARN;
    if (!topicArn) {
      throw new Error("BILLING_EVENTS_TOPIC_ARN environment variable is not set");
    }
    this.topicArn = topicArn;
    this.client = new SNSClient({});
  }

  async publish(event: BillingDomainEvent<any>): Promise<void> {
    try {
      await this.client.send(
        new PublishCommand({
          TopicArn: this.topicArn,
          Message: JSON.stringify(event),
          MessageAttributes: {
            eventType: {
              DataType: "String",
              StringValue: event.type,
            },
          },
        })
      );
      console.log(`Published billing event: ${event.type} (${event.meta.eventId})`);
    } catch (error) {
      console.error(`Failed to publish billing event ${event.type}:`, error);
      throw error;
    }
  }

  createMetadata(source: string = "stripe-service"): BillingEventMetadata {
    return {
      eventId: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      occurredAt: new Date().toISOString(),
      source: source as any,
    };
  }
}

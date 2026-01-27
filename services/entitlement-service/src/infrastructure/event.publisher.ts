import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { BillingEvent } from "@libs/domain";

type EntitlementCreatedEvent = BillingEvent.EntitlementCreatedEvent;
type EntitlementUpdatedEvent = BillingEvent.EntitlementUpdatedEvent;
type EntitlementRevokedEvent = BillingEvent.EntitlementRevokedEvent;
const EntitlementEventType = BillingEvent.EntitlementEventType;
type BillingEventMetadata = BillingEvent.BillingEventMetadata;

export class EntitlementEventPublisher {
  private readonly topicArn: string;
  private readonly client: SNSClient;

  constructor() {
    const topicArn = process.env.ENTITLEMENT_UPDATES_TOPIC_ARN;
    if (!topicArn) {
      throw new Error("ENTITLEMENT_UPDATES_TOPIC_ARN environment variable is not set");
    }
    this.topicArn = topicArn;
    this.client = new SNSClient({});
  }

  async publishCreated(payload: EntitlementCreatedEvent["payload"], metadata: BillingEventMetadata): Promise<void> {
    const event: EntitlementCreatedEvent = {
      type: EntitlementEventType.ENTITLEMENT_CREATED,
      payload,
      meta: metadata,
      version: 1
    };

    await this.publish(event);
  }

  async publishUpdated(payload: EntitlementUpdatedEvent["payload"], metadata: BillingEventMetadata): Promise<void> {
    const event: EntitlementUpdatedEvent = {
      type: EntitlementEventType.ENTITLEMENT_UPDATED,
      payload,
      meta: metadata,
      version: 1
    };

    await this.publish(event);
  }

  async publishRevoked(payload: EntitlementRevokedEvent["payload"], metadata: BillingEventMetadata): Promise<void> {
    const event: EntitlementRevokedEvent = {
      type: EntitlementEventType.ENTITLEMENT_REVOKED,
      payload,
      meta: metadata,
      version: 1
    };

    await this.publish(event);
  }

  private async publish(event: EntitlementCreatedEvent | EntitlementUpdatedEvent | EntitlementRevokedEvent): Promise<void> {
    try {
      await this.client.send(
        new PublishCommand({
          TopicArn: this.topicArn,
          Message: JSON.stringify(event),
          MessageAttributes: {
            eventType: {
              DataType: "String",
              StringValue: event.type
            }
          }
        })
      );
      console.log(`Published entitlement event: ${event.type} for user ${event.payload.userId}`);
    } catch (error) {
      console.error(`Failed to publish entitlement event ${event.type}:`, error);
      // Don't throw - event publishing failure shouldn't fail the main process
    }
  }
}

import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { UserDomainEvent, UserCreatedEvent, UserUpdatedEvent, UserEventType } from "../domain/events/user-events.types";

export class UserEventPublisher {
  private readonly topicArn: string;
  private readonly client: SNSClient;

  constructor() {
    const topicArn = process.env.USER_EVENTS_TOPIC_ARN;
    if (!topicArn) {
      throw new Error("USER_EVENTS_TOPIC_ARN environment variable is not set");
    }
    this.topicArn = topicArn;
    this.client = new SNSClient({});
  }

  async publish(event: UserDomainEvent): Promise<void> {
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
      console.log(`Published user event: ${event.type} for user ${event.payload.userId}`);
    } catch (error) {
      console.error(`Failed to publish user event ${event.type}:`, error);
      // Don't throw - event publishing failure shouldn't fail the main process
    }
  }

  async publishUserCreated(payload: UserCreatedEvent["payload"]): Promise<void> {
    const event: UserCreatedEvent = {
      type: UserEventType.USER_CREATED,
      payload,
      meta: {
        eventId: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        occurredAt: new Date().toISOString(),
        source: "auth-service",
      },
      version: 1,
    };

    await this.publish(event);
  }

  async publishUserUpdated(payload: UserUpdatedEvent["payload"]): Promise<void> {
    const event: UserUpdatedEvent = {
      type: UserEventType.USER_UPDATED,
      payload,
      meta: {
        eventId: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        occurredAt: new Date().toISOString(),
        source: "auth-service",
      },
      version: 1,
    };

    await this.publish(event);
  }
}

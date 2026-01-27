import {
  DynamoDBClient,
} from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";

export interface WebhookEvent {
  eventId: string;
  processedAt: string;
  status: "processed" | "failed";
  ttl?: number;
}

export class WebhookIdempotencyRepository {
  private readonly tableName: string;
  private readonly client: DynamoDBDocumentClient;

  constructor() {
    const tableName = process.env.WEBHOOK_IDEMPOTENCY_TABLE;
    if (!tableName) {
      throw new Error("WEBHOOK_IDEMPOTENCY_TABLE environment variable is not set");
    }
    this.tableName = tableName;
    this.client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  }

  async isProcessed(eventId: string): Promise<boolean> {
    const result = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          eventId,
        },
      })
    );

    return !!result.Item;
  }

  async markAsProcessed(eventId: string, status: "processed" | "failed" = "processed"): Promise<void> {
    const now = new Date();
    const ttl = Math.floor(now.getTime() / 1000) + (30 * 24 * 60 * 60);

    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          eventId,
          processedAt: now.toISOString(),
          status,
          ttl,
        },
      })
    );
  }
}

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

const IDEMPOTENCY_KEY_PREFIX = "PAYMENT#";
const TTL_DAYS = 90;

export interface ProcessedPaymentsRepository {
  isPaymentProcessed(paymentIntentId: string): Promise<boolean>;
  markPaymentProcessed(paymentIntentId: string): Promise<void>;
}

export class DynamoProcessedPaymentsRepository implements ProcessedPaymentsRepository {
  private readonly tableName: string;
  private readonly client: DynamoDBDocumentClient;

  constructor(tableName: string, client?: DynamoDBDocumentClient) {
    this.tableName = tableName;
    this.client =
      client ??
      DynamoDBDocumentClient.from(new DynamoDBClient({}));
  }

  async isPaymentProcessed(paymentIntentId: string): Promise<boolean> {
    const eventId = `${IDEMPOTENCY_KEY_PREFIX}${paymentIntentId}`;
    const result = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { eventId },
      })
    );
    return !!result.Item;
  }

  async markPaymentProcessed(paymentIntentId: string): Promise<void> {
    const eventId = `${IDEMPOTENCY_KEY_PREFIX}${paymentIntentId}`;
    const ttlSeconds = Math.floor(Date.now() / 1000) + TTL_DAYS * 24 * 60 * 60;
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          eventId,
          ttl: ttlSeconds,
          processedAt: new Date().toISOString(),
        },
      })
    );
  }
}

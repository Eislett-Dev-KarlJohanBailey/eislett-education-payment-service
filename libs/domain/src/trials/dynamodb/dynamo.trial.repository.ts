import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { TrialRepository } from "../app/ports/trial.repository";
import { TrialRecord } from "../domain/entities/trial-record.entity";

export class DynamoTrialRepository implements TrialRepository {
  private readonly client: DynamoDBDocumentClient;
  private readonly tableName: string;

  constructor(tableName: string) {
    this.tableName = tableName;
    const dynamoClient = new DynamoDBClient({});
    this.client = DynamoDBDocumentClient.from(dynamoClient);
  }

  async findByUserAndProduct(userId: string, productId: string): Promise<TrialRecord | null> {
    const result = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: `USER#${userId}`,
          SK: `PRODUCT#${productId}`,
        },
      })
    );

    if (!result.Item) {
      return null;
    }

    return this.toDomain(result.Item);
  }

  async findByUser(userId: string): Promise<TrialRecord[]> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: {
          ":pk": `USER#${userId}`,
        },
      })
    );

    return (result.Items ?? []).map(this.toDomain);
  }

  async save(trial: TrialRecord): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: this.toDynamo(trial),
      })
    );
  }

  async update(trial: TrialRecord): Promise<void> {
    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          PK: `USER#${trial.userId}`,
          SK: `PRODUCT#${trial.productId}`,
        },
        UpdateExpression: "SET #status = :status",
        ExpressionAttributeNames: {
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":status": trial.status,
        },
      })
    );
  }

  private toDynamo(trial: TrialRecord): Record<string, any> {
    return {
      PK: `USER#${trial.userId}`,
      SK: `PRODUCT#${trial.productId}`,
      userId: trial.userId,
      productId: trial.productId,
      startedAt: trial.startedAt.toISOString(),
      expiresAt: trial.expiresAt.toISOString(),
      status: trial.status,
    };
  }

  private toDomain(item: Record<string, any>): TrialRecord {
    return new TrialRecord(
      item.userId,
      item.productId,
      new Date(item.startedAt),
      new Date(item.expiresAt),
      item.status
    );
  }
}

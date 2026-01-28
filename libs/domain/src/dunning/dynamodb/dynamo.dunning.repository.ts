import {
  DynamoDBClient,
} from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { DunningRepository } from "../app/ports/dunning.repository";
import { DunningRecord } from "../domain/entities/dunning-record.entity";
import { DunningState } from "../domain/value-objects/dunning-state.vo";

interface DunningRecordItem {
  userId: string;
  state: string;
  portalUrl?: string;
  expiresAt?: string;
  detectedAt: string;
  lastUpdatedAt: string;
  paymentIntentId?: string;
  invoiceId?: string;
  subscriptionId?: string;
  failureCode?: string;
  failureReason?: string;
}

export class DynamoDunningRepository implements DunningRepository {
  private readonly tableName: string;
  private readonly client: DynamoDBDocumentClient;

  constructor(tableName?: string) {
    this.tableName = tableName || process.env.DUNNING_TABLE || "";
    if (!this.tableName) {
      throw new Error("DUNNING_TABLE environment variable is not set");
    }

    const dynamoClient = new DynamoDBClient({});
    this.client = DynamoDBDocumentClient.from(dynamoClient);
  }

  async findByUserId(userId: string): Promise<DunningRecord | null> {
    const result = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          userId,
        },
      })
    );

    if (!result.Item) {
      return null;
    }

    return this.toDomain(result.Item as DunningRecordItem);
  }

  async save(record: DunningRecord): Promise<void> {
    const item = this.toItem(record);
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: item,
      })
    );
  }

  async delete(userId: string): Promise<void> {
    await this.client.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: {
          userId,
        },
      })
    );
  }

  private toDomain(item: DunningRecordItem): DunningRecord {
    return new DunningRecord({
      userId: item.userId,
      state: item.state as DunningState,
      portalUrl: item.portalUrl,
      expiresAt: item.expiresAt ? new Date(item.expiresAt) : undefined,
      detectedAt: new Date(item.detectedAt),
      lastUpdatedAt: new Date(item.lastUpdatedAt),
      paymentIntentId: item.paymentIntentId,
      invoiceId: item.invoiceId,
      subscriptionId: item.subscriptionId,
      failureCode: item.failureCode,
      failureReason: item.failureReason,
    });
  }

  private toItem(record: DunningRecord): DunningRecordItem {
    return {
      userId: record.userId,
      state: record.state,
      portalUrl: record.portalUrl,
      expiresAt: record.expiresAt?.toISOString(),
      detectedAt: record.detectedAt.toISOString(),
      lastUpdatedAt: record.lastUpdatedAt.toISOString(),
      paymentIntentId: record.paymentIntentId,
      invoiceId: record.invoiceId,
      subscriptionId: record.subscriptionId,
      failureCode: record.failureCode,
      failureReason: record.failureReason,
    };
  }
}

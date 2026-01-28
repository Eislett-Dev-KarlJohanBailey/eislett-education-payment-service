import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { TransactionRepository } from "../app/ports/transaction.repository";
import { Transaction } from "../domain/entities/transaction.entity";

export class DynamoTransactionRepository implements TransactionRepository {
  private readonly client: DynamoDBDocumentClient;
  private readonly tableName: string;

  constructor(tableName: string) {
    this.tableName = tableName;
    const dynamoClient = new DynamoDBClient({});
    this.client = DynamoDBDocumentClient.from(dynamoClient);
  }

  async save(transaction: Transaction): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: this.toDynamo(transaction),
      })
    );
  }

  async findByUserId(userId: string, limit = 100): Promise<Transaction[]> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: {
          ":pk": `USER#${userId}`,
        },
        ScanIndexForward: false, // Most recent first
        Limit: limit,
      })
    );

    return (result.Items ?? []).map(this.toDomain);
  }

  async findAll(limit = 100): Promise<Transaction[]> {
    const result = await this.client.send(
      new ScanCommand({
        TableName: this.tableName,
        Limit: limit,
      })
    );

    // Sort by createdAt descending (most recent first)
    const transactions = (result.Items ?? []).map(this.toDomain);
    return transactions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit);
  }

  async findById(transactionId: string): Promise<Transaction | null> {
    // Note: This requires a GSI or knowing the userId
    // For now, we'll need to scan or use a different approach
    // This is a limitation - in production, you might want a GSI on transactionId
    const result = await this.client.send(
      new ScanCommand({
        TableName: this.tableName,
        FilterExpression: "transactionId = :tid",
        ExpressionAttributeValues: {
          ":tid": transactionId,
        },
        Limit: 1,
      })
    );

    if (!result.Items || result.Items.length === 0) {
      return null;
    }

    return this.toDomain(result.Items[0]);
  }

  private toDynamo(transaction: Transaction): Record<string, any> {
    return {
      PK: `USER#${transaction.userId}`,
      SK: `TRANSACTION#${transaction.transactionId}#${transaction.createdAt.toISOString()}`,
      transactionId: transaction.transactionId,
      userId: transaction.userId,
      type: transaction.type,
      status: transaction.status,
      amount: transaction.amount,
      currency: transaction.currency,
      productId: transaction.productId,
      priceId: transaction.priceId,
      subscriptionId: transaction.subscriptionId,
      createdAt: transaction.createdAt.toISOString(),
      metadata: transaction.metadata ? JSON.stringify(transaction.metadata) : undefined,
    };
  }

  private toDomain(item: Record<string, any>): Transaction {
    return new Transaction(
      item.transactionId,
      item.userId,
      item.type,
      item.status,
      item.amount,
      item.currency,
      new Date(item.createdAt),
      item.productId,
      item.priceId,
      item.subscriptionId,
      item.metadata ? JSON.parse(item.metadata) : undefined
    );
  }
}

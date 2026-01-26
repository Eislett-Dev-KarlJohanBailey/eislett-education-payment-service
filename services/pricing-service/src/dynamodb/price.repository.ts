import {
  DynamoDBClient
} from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  DeleteCommand
} from "@aws-sdk/lib-dynamodb";

import { PriceMapper } from "./price.mapper";
import { PriceRepository, Pagination, PaginatedResult } from "../app/ports/price.repository.port";
import { Price } from "../domain/entities/price.entity";

export class DynamoPriceRepository implements PriceRepository {
  private readonly tableName: string;
  private readonly client: DynamoDBDocumentClient;

  constructor() {
    const tableName = process.env.PRICES_TABLE;
    if (!tableName) {
      throw new Error("PRICES_TABLE environment variable is not set");
    }
    this.tableName = tableName;
    console.log("DynamoPriceRepository initialized with table:", this.tableName);
    
    const raw = new DynamoDBClient({});
    this.client = DynamoDBDocumentClient.from(raw);
  }

  async create(price: Price): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: PriceMapper.toItem(price)
      })
    );
  }

  async update(price: Price): Promise<void> {
    await this.create(price); // overwrite pattern
  }

  async delete(priceId: string): Promise<void> {
    await this.client.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: {
          PK: `PRICE#${priceId}`,
          SK: "METADATA"
        }
      })
    );
  }

  async findById(priceId: string): Promise<Price | null> {
    const result = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: `PRICE#${priceId}`,
          SK: "METADATA"
        }
      })
    );

    if (!result.Item) return null;
    return PriceMapper.toDomain(result.Item);
  }

  async findByProductId(
    productId: string,
    pagination: Pagination
  ): Promise<PaginatedResult<Price>> {
    const pageSize = pagination.pageSize;
    const pageNumber = pagination.pageNumber;

    if (pageNumber < 1) {
      throw new Error("pageNumber must be >= 1");
    }

    const pk = `PRODUCT#${productId}`;
    const startIndex = (pageNumber - 1) * pageSize;

    let lastEvaluatedKey: any = undefined;
    let items: Price[] = [];
    let scannedCount = 0;

    // Fetch items until we have enough for the requested page
    while (items.length < pageSize) {
      const result = await this.client.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: "GSI1",
          KeyConditionExpression: "GSI1PK = :pk",
          ExpressionAttributeValues: {
            ":pk": pk
          },
          Limit: pageSize * 2, // Fetch more to account for pagination
          ExclusiveStartKey: lastEvaluatedKey
        })
      );

      lastEvaluatedKey = result.LastEvaluatedKey;
      const batch = (result.Items ?? []).map(PriceMapper.toDomain);
      
      // Add items starting from the correct offset
      for (const item of batch) {
        if (scannedCount >= startIndex && items.length < pageSize) {
          items.push(item);
        }
        scannedCount++;
      }

      if (!lastEvaluatedKey) break;
    }

    return {
      items: items.slice(0, pageSize),
      total: -1, // DynamoDB doesn't do totals cheaply
      pageNumber,
      pageSize
    };
  }
}

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
  
import { ProductMapper } from "./product.mapper";
import { ProductRepository } from "../app/ports/product.repository.port";
import { Product } from "../domain/entities/product.entity";
import { ProductType } from "../domain/value-objects/product-type.vo";
import { ProductListFilters } from "../app/ports/product.repository.port";
import { Pagination } from "../app/ports/product.repository.port";
import { PaginatedResult } from "../app/ports/product.repository.port";

  export class DynamoProductRepository implements ProductRepository {
    private readonly tableName = process.env.PRODUCTS_TABLE!;
    private readonly client: DynamoDBDocumentClient;
  
    constructor() {
      const raw = new DynamoDBClient({});
      this.client = DynamoDBDocumentClient.from(raw);
    }
  
    async create(product: Product): Promise<void> {
      await this.client.send(
        new PutCommand({
          TableName: this.tableName,
          Item: ProductMapper.toItem(product)
        })
      );
    }
  
    async update(product: Product): Promise<void> {
      await this.create(product); // overwrite pattern
    }
  
    async delete(productId: string): Promise<void> {
      await this.client.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: {
            PK: `PRODUCT#${productId}`,
            SK: "METADATA"
          }
        })
      );
    }
  
    async findById(productId: string): Promise<Product | null> {
      const result = await this.client.send(
        new GetCommand({
          TableName: this.tableName,
          Key: {
            PK: `PRODUCT#${productId}`,
            SK: "METADATA"
          }
        })
      );
  
      if (!result.Item) return null;
      return ProductMapper.toDomain(result.Item);
    }
  
    async list(
      filters: ProductListFilters,
      pagination: Pagination
    ): Promise<PaginatedResult<Product>> {
  
      const pageSize = pagination.pageSize;
      const pageNumber = pagination.pageNumber;
  
      if (pageNumber < 1) {
        throw new Error("pageNumber must be >= 1");
      }
  
      // We emulate offset pagination by iterating pages internally
      let lastEvaluatedKey: any = undefined;
      let filteredScanned = 0;
      let items: Product[] = [];

      const pk =
        filters.type
          ? `TYPE#${filters.type}`
          : `TYPE#${ProductType.SUBSCRIPTION}`; // default view

      // Continue fetching until we have enough filtered items for the target page
      while (filteredScanned < pageNumber * pageSize) {
        const filterExpressions: string[] = [];
        const expressionAttributeValues: Record<string, any> = {
          ":pk": pk
        };

        if (filters.isActive !== undefined) {
          filterExpressions.push("isActive = :active");
          expressionAttributeValues[":active"] = filters.isActive;
        }

        const result = await this.client.send(
          new QueryCommand({
            TableName: this.tableName,
            IndexName: "GSI1",
            KeyConditionExpression: "GSI1PK = :pk",
            ExpressionAttributeValues: expressionAttributeValues,
            ...(filterExpressions.length > 0 && {
              FilterExpression: filterExpressions.join(" AND ")
            }),
            Limit: pageSize,
            ExclusiveStartKey: lastEvaluatedKey
          })
        );

        lastEvaluatedKey = result.LastEvaluatedKey;

        let batch = (result.Items ?? []).map(ProductMapper.toDomain);
        
        // Filter by namePrefix if provided (client-side filtering since begins_with can't be used in FilterExpression)
        if (filters.namePrefix) {
          batch = batch.filter(product => 
            product.name.toLowerCase().startsWith(filters.namePrefix!.toLowerCase())
          );
        }
        
        // Only add items that belong to the target page
        const startIndex = (pageNumber - 1) * pageSize;
        const endIndex = pageNumber * pageSize;
        
        for (const item of batch) {
          if (filteredScanned >= startIndex && filteredScanned < endIndex) {
            items.push(item);
          }
          filteredScanned++;
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
  
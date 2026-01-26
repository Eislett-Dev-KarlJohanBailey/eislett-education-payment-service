import {
    DynamoDBClient
  } from "@aws-sdk/client-dynamodb";
  import {
    DynamoDBDocumentClient,
    PutCommand,
    QueryCommand
  } from "@aws-sdk/lib-dynamodb";
import { EntitlementRepository } from "../app/ports/entitlement.repository";
import { Entitlement } from "../domain/entities/entitlement.entity";
import { EntitlementStatus } from "../domain/value-objects/entitlement-status.vo";
import { EntitlementUsage } from "../domain/entities/entitlement-usage.entity";
  
  
  export class DynamoEntitlementRepository implements EntitlementRepository {
    private readonly tableName: string;
    private readonly client: DynamoDBDocumentClient;
  
    constructor(tableName: string, client?: DynamoDBDocumentClient) {
      this.tableName = tableName;
  
      this.client =
        client ??
        DynamoDBDocumentClient.from(
          new DynamoDBClient({})
        );
    }
  
    async findByUser(userId: string): Promise<Entitlement[]> {
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
  
    async save(entitlement: Entitlement): Promise<void> {
      await this.client.send(
        new PutCommand({
          TableName: this.tableName,
          Item: this.toItem(entitlement),
        })
      );
    }
  
    async update(entitlement: Entitlement): Promise<void> {
      // Put is idempotent for this model
      await this.save(entitlement);
    }
  
    // ---------- Mapping ----------
  
    private toItem(entitlement: Entitlement): Record<string, any> {
      return {
        PK: `USER#${entitlement.userId}`,
        SK: `ENTITLEMENT#${entitlement.key}`,
  
        userId: entitlement.userId,
        entitlementKey: entitlement.key,
        role: entitlement.role,
        status: entitlement.status,
  
        grantedAt: entitlement.grantedAt.toISOString(),
        expiresAt: entitlement.expiresAt?.toISOString(),
  
        usage: entitlement.usage
          ? {
              limit: entitlement.usage.limit,
              used: entitlement.usage.used,
              resetAt: entitlement.usage.resetAt?.toISOString(),
            }
          : undefined,
      };
    }
  
    private toDomain(item: Record<string, any>): Entitlement {
      return new Entitlement(
        item.userId,
        item.entitlementKey,
        item.role,
        item.status as EntitlementStatus,
        new Date(item.grantedAt),
        item.expiresAt ? new Date(item.expiresAt) : undefined,
        item.usage
          ? new EntitlementUsage(
              item.usage.limit,
              item.usage.used,
              item.usage.resetAt
                ? new Date(item.usage.resetAt)
                : undefined
            )
          : undefined
      );
    }
  }
  
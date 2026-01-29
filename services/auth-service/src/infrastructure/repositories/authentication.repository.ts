import {
  DynamoDBClient,
} from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { AuthenticationEntity } from "../../domain/entities/authentication.entity";

export interface AuthenticationRepository {
  findByUserId(userId: string): Promise<AuthenticationEntity[]>;
  findByUserIdAndProvider(userId: string, provider: string): Promise<AuthenticationEntity | null>;
  findByProviderId(provider: string, providerId: string): Promise<AuthenticationEntity | null>; // Lookup by provider + providerId
  save(auth: AuthenticationEntity): Promise<void>;
}

export class DynamoAuthenticationRepository implements AuthenticationRepository {
  private readonly tableName: string;
  private readonly client: DynamoDBDocumentClient;

  constructor(tableName: string, client?: DynamoDBDocumentClient) {
    this.tableName = tableName;
    this.client = client ?? DynamoDBDocumentClient.from(new DynamoDBClient({}));
  }

  async findByUserId(userId: string): Promise<AuthenticationEntity[]> {
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

  async findByUserIdAndProvider(userId: string, provider: string): Promise<AuthenticationEntity | null> {
    const result = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: `USER#${userId}`,
          SK: `AUTH#${provider}`,
        },
      })
    );

    if (!result.Item) {
      return null;
    }

    return this.toDomain(result.Item);
  }

  async findByProviderId(provider: string, providerId: string): Promise<AuthenticationEntity | null> {
    // Use GSI1 to lookup by provider + providerId
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :gsi1pk",
        ExpressionAttributeValues: {
          ":gsi1pk": `PROVIDER#${provider}#${providerId}`,
        },
      })
    ) as { Items?: Record<string, any>[] };

    if (!result.Items || result.Items.length === 0) {
      return null;
    }

    return this.toDomain(result.Items[0]);
  }

  async save(auth: AuthenticationEntity): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: this.toItem(auth),
      })
    );
  }

  private toItem(auth: AuthenticationEntity): Record<string, any> {
    return {
      PK: `USER#${auth.userId}`,
      SK: `AUTH#${auth.provider}`,
      authenticationId: auth.authenticationId,
      userId: auth.userId,
      provider: auth.provider,
      providerId: auth.providerId,
      accessToken: auth.accessToken,
      refreshToken: auth.refreshToken,
      expiresAt: auth.expiresAt?.toISOString(),
      createdAt: auth.createdAt.toISOString(),
      updatedAt: auth.updatedAt.toISOString(),
      // For GSI lookup by provider + providerId
      GSI1PK: `PROVIDER#${auth.provider}#${auth.providerId}`,
      GSI1SK: `AUTH`,
    };
  }

  private toDomain(item: Record<string, any>): AuthenticationEntity {
    return new AuthenticationEntity(
      item.authenticationId,
      item.userId,
      item.provider,
      item.providerId,
      item.accessToken,
      item.refreshToken,
      item.expiresAt ? new Date(item.expiresAt) : undefined,
      new Date(item.createdAt),
      new Date(item.updatedAt)
    );
  }
}

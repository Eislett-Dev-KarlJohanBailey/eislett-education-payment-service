import {
  DynamoDBClient,
} from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { UserEntity } from "../../domain/entities/user.entity";
import { AuthenticationRepository } from "./authentication.repository";

export interface UserRepository {
  findByUserId(userId: string): Promise<UserEntity | null>;
  findByEmail(email: string): Promise<UserEntity | null>;
  findByGoogleId(googleId: string): Promise<UserEntity | null>; // Legacy - for backward compatibility
  findByProviderId(provider: string, providerId: string): Promise<UserEntity | null>; // Generic provider lookup
  save(user: UserEntity): Promise<void>;
  update(user: UserEntity): Promise<void>;
}

export class DynamoUserRepository implements UserRepository {
  private readonly tableName: string;
  private readonly client: DynamoDBDocumentClient;
  private readonly authRepo?: AuthenticationRepository;

  constructor(tableName: string, client?: DynamoDBDocumentClient, authRepo?: AuthenticationRepository) {
    this.tableName = tableName;
    this.client = client ?? DynamoDBDocumentClient.from(new DynamoDBClient({}));
    this.authRepo = authRepo;
  }

  async findByUserId(userId: string): Promise<UserEntity | null> {
    const result = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: `USER#${userId}`,
          SK: `PROFILE`,
        },
      })
    );

    if (!result.Item) {
      return null;
    }

    return this.toDomain(result.Item);
  }

  async findByEmail(_email: string): Promise<UserEntity | null> {
    // Email lookup not implemented - use findByGoogleId or findByUserId
    // If needed, add GSI: email-index with PK=EMAIL#{email}
    throw new Error("findByEmail not implemented - use findByGoogleId or findByUserId");
  }

  async findByGoogleId(googleId: string): Promise<UserEntity | null> {
    // Legacy method - use GSI1PK which is set to GOOGLE#{googleId}
    // For new implementations, use findByProviderId("google", googleId)
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :gsi1pk",
        ExpressionAttributeValues: {
          ":gsi1pk": `GOOGLE#${googleId}`,
        },
      })
    ) as { Items?: Record<string, any>[] };

    if (!result.Items || result.Items.length === 0) {
      return null;
    }

    return this.toDomain(result.Items[0]);
  }

  async findByProviderId(provider: string, providerId: string): Promise<UserEntity | null> {
    // Use authentication table to find user by provider + providerId
    if (!this.authRepo) {
      throw new Error("AuthenticationRepository is required for findByProviderId");
    }

    const auth = await this.authRepo.findByProviderId(provider, providerId);
    if (!auth) {
      return null;
    }

    // Get user by userId from auth record
    return await this.findByUserId(auth.userId);
  }

  async save(user: UserEntity): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: this.toItem(user),
      })
    );
  }

  async update(user: UserEntity): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: this.toItem(user),
      })
    );
  }

  private toItem(user: UserEntity): Record<string, any> {
    const item: Record<string, any> = {
      PK: `USER#${user.userId}`,
      SK: `PROFILE`,
      userId: user.userId,
      email: user.email,
      name: user.name,
      picture: user.picture,
      role: user.role,
      preferredLanguage: user.preferredLanguage,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };

    // Only set GSI1 for Google users (backward compatibility)
    if (user.googleId) {
      item.googleId = user.googleId;
      item.GSI1PK = `GOOGLE#${user.googleId}`;
      item.GSI1SK = `PROFILE`;
    }

    return item;
  }

  private toDomain(item: Record<string, any>): UserEntity {
    return new UserEntity(
      item.userId,
      item.email,
      item.role,
      item.name,
      item.picture,
      item.preferredLanguage,
      item.googleId, // Optional
      new Date(item.createdAt),
      new Date(item.updatedAt)
    );
  }
}

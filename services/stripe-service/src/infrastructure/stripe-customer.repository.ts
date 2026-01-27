import {
  DynamoDBClient,
} from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";

export interface StripeCustomer {
  userId: string;
  stripeCustomerId: string;
  role?: string;
  email?: string;
  createdAt: string;
  updatedAt: string;
}

export class StripeCustomerRepository {
  private readonly tableName: string;
  private readonly client: DynamoDBDocumentClient;

  constructor() {
    const tableName = process.env.STRIPE_CUSTOMERS_TABLE;
    if (!tableName) {
      throw new Error("STRIPE_CUSTOMERS_TABLE environment variable is not set");
    }
    this.tableName = tableName;
    this.client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  }

  async findByUserId(userId: string): Promise<StripeCustomer | null> {
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

    return result.Item as StripeCustomer;
  }

  async findByStripeCustomerId(stripeCustomerId: string): Promise<StripeCustomer | null> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: "stripeCustomerId-index",
        KeyConditionExpression: "stripeCustomerId = :customerId",
        ExpressionAttributeValues: {
          ":customerId": stripeCustomerId,
        },
      })
    );

    if (!result.Items || result.Items.length === 0) {
      return null;
    }

    return result.Items[0] as StripeCustomer;
  }

  async create(customer: Omit<StripeCustomer, "createdAt" | "updatedAt">): Promise<void> {
    const now = new Date().toISOString();
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          ...customer,
          createdAt: now,
          updatedAt: now,
        },
      })
    );
  }

  async update(customer: Partial<StripeCustomer> & { userId: string }): Promise<void> {
    const existing = await this.findByUserId(customer.userId);
    if (!existing) {
      throw new Error(`Customer not found for userId: ${customer.userId}`);
    }

    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          ...existing,
          ...customer,
          updatedAt: new Date().toISOString(),
        },
      })
    );
  }
}

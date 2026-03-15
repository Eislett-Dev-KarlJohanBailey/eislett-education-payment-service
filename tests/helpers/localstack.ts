import {
  DynamoDBClient,
  CreateTableCommand,
  DeleteTableCommand,
  ListTablesCommand,
  type KeySchemaElement,
  type AttributeDefinition,
  type GlobalSecondaryIndex,
} from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { SNSClient, CreateTopicCommand, SubscribeCommand } from "@aws-sdk/client-sns";
import {
  SQSClient,
  CreateQueueCommand,
  GetQueueAttributesCommand,
  SetQueueAttributesCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  GetQueueUrlCommand,
} from "@aws-sdk/client-sqs";

const ENDPOINT = process.env.LOCALSTACK_ENDPOINT || "http://localhost:4566";
const REGION = "us-east-1";

function clientConfig() {
  return {
    region: REGION,
    endpoint: ENDPOINT,
    credentials: { accessKeyId: "test", secretAccessKey: "test" },
  };
}

export function dynamoClient() {
  return new DynamoDBClient(clientConfig());
}

export function docClient() {
  return DynamoDBDocumentClient.from(dynamoClient(), {
    marshallOptions: { removeUndefinedValues: true },
  });
}

export function snsClient() {
  return new SNSClient(clientConfig());
}

interface TableDef {
  TableName: string;
  KeySchema: KeySchemaElement[];
  AttributeDefinitions: AttributeDefinition[];
  GlobalSecondaryIndexes?: GlobalSecondaryIndex[];
}

const PAYMENT_TABLES: TableDef[] = [
  {
    TableName: "products-test",
    KeySchema: [
      { AttributeName: "PK", KeyType: "HASH" },
      { AttributeName: "SK", KeyType: "RANGE" },
    ],
    AttributeDefinitions: [
      { AttributeName: "PK", AttributeType: "S" },
      { AttributeName: "SK", AttributeType: "S" },
      { AttributeName: "GSI1PK", AttributeType: "S" },
      { AttributeName: "GSI1SK", AttributeType: "S" },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: "GSI1",
        KeySchema: [
          { AttributeName: "GSI1PK", KeyType: "HASH" },
          { AttributeName: "GSI1SK", KeyType: "RANGE" },
        ],
        Projection: { ProjectionType: "ALL" },
      },
    ],
  },
  {
    TableName: "prices-test",
    KeySchema: [
      { AttributeName: "PK", KeyType: "HASH" },
      { AttributeName: "SK", KeyType: "RANGE" },
    ],
    AttributeDefinitions: [
      { AttributeName: "PK", AttributeType: "S" },
      { AttributeName: "SK", AttributeType: "S" },
      { AttributeName: "GSI1PK", AttributeType: "S" },
      { AttributeName: "GSI1SK", AttributeType: "S" },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: "GSI1",
        KeySchema: [
          { AttributeName: "GSI1PK", KeyType: "HASH" },
          { AttributeName: "GSI1SK", KeyType: "RANGE" },
        ],
        Projection: { ProjectionType: "ALL" },
      },
    ],
  },
  {
    TableName: "entitlements-test",
    KeySchema: [
      { AttributeName: "PK", KeyType: "HASH" },
      { AttributeName: "SK", KeyType: "RANGE" },
    ],
    AttributeDefinitions: [
      { AttributeName: "PK", AttributeType: "S" },
      { AttributeName: "SK", AttributeType: "S" },
    ],
  },
  {
    TableName: "dunning-test",
    KeySchema: [{ AttributeName: "userId", KeyType: "HASH" }],
    AttributeDefinitions: [
      { AttributeName: "userId", AttributeType: "S" },
    ],
  },
  {
    TableName: "transactions-test",
    KeySchema: [
      { AttributeName: "PK", KeyType: "HASH" },
      { AttributeName: "SK", KeyType: "RANGE" },
    ],
    AttributeDefinitions: [
      { AttributeName: "PK", AttributeType: "S" },
      { AttributeName: "SK", AttributeType: "S" },
    ],
  },
  {
    TableName: "trials-test",
    KeySchema: [
      { AttributeName: "PK", KeyType: "HASH" },
      { AttributeName: "SK", KeyType: "RANGE" },
    ],
    AttributeDefinitions: [
      { AttributeName: "PK", AttributeType: "S" },
      { AttributeName: "SK", AttributeType: "S" },
    ],
  },
  {
    TableName: "processed-events-test",
    KeySchema: [
      { AttributeName: "PK", KeyType: "HASH" },
      { AttributeName: "SK", KeyType: "RANGE" },
    ],
    AttributeDefinitions: [
      { AttributeName: "PK", AttributeType: "S" },
      { AttributeName: "SK", AttributeType: "S" },
    ],
  },
];

export async function createAllTables(): Promise<void> {
  const ddb = dynamoClient();
  const existing = await ddb.send(new ListTablesCommand({}));
  const existingNames = new Set(existing.TableNames ?? []);

  for (const def of PAYMENT_TABLES) {
    if (existingNames.has(def.TableName)) continue;

    await ddb.send(
      new CreateTableCommand({
        ...def,
        BillingMode: "PAY_PER_REQUEST",
      })
    );
  }
}

export async function deleteAllTables(): Promise<void> {
  const ddb = dynamoClient();
  for (const def of PAYMENT_TABLES) {
    try {
      await ddb.send(new DeleteTableCommand({ TableName: def.TableName }));
    } catch {
      // table may not exist
    }
  }
}

export async function clearTable(
  tableName: string,
  keys: string[] = ["PK", "SK"]
): Promise<void> {
  const ddb = DynamoDBDocumentClient.from(dynamoClient());
  const projection = keys.join(", ");
  let lastKey: Record<string, unknown> | undefined;

  do {
    const scan = await ddb.send(
      new ScanCommand({
        TableName: tableName,
        ProjectionExpression: projection,
        ExclusiveStartKey: lastKey,
      })
    );

    if (scan.Items?.length) {
      await Promise.all(
        scan.Items.map((item) => {
          const key: Record<string, unknown> = {};
          for (const k of keys) {
            key[k] = item[k];
          }
          return ddb.send(
            new DeleteCommand({ TableName: tableName, Key: key })
          );
        })
      );
    }

    lastKey = scan.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);
}

export async function createSnsTopic(name: string): Promise<string> {
  const sns = snsClient();
  const result = await sns.send(new CreateTopicCommand({ Name: name }));
  return result.TopicArn!;
}

export function sqsClient() {
  return new SQSClient(clientConfig());
}

/**
 * Create an SQS queue and subscribe it to an SNS topic so we can receive published messages in e2e tests.
 * Returns the queue URL. Call receiveEntitlementUpdateFromQueue(queueUrl) to poll for messages.
 */
export async function createQueueSubscribedToSns(
  queueName: string,
  topicArn: string
): Promise<string> {
  const sqs = sqsClient();
  const { QueueUrl } = await sqs.send(
    new CreateQueueCommand({ QueueName: queueName })
  );
  if (!QueueUrl) throw new Error("CreateQueue did not return QueueUrl");

  const { Attributes } = await sqs.send(
    new GetQueueAttributesCommand({
      QueueUrl,
      AttributeNames: ["QueueArn"],
    })
  );
  const queueArn = Attributes?.QueueArn;
  if (!queueArn) throw new Error("QueueArn not found");

  const policy = {
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: { Service: "sns.amazonaws.com" },
        Action: "sqs:SendMessage",
        Resource: queueArn,
        Condition: { ArnEquals: { "aws:SourceArn": topicArn } },
      },
    ],
  };
  await sqs.send(
    new SetQueueAttributesCommand({
      QueueUrl,
      Attributes: { Policy: JSON.stringify(policy) },
    })
  );

  await snsClient().send(
    new SubscribeCommand({
      TopicArn: topicArn,
      Protocol: "sqs",
      Endpoint: queueArn,
    })
  );

  return QueueUrl;
}

/**
 * Receive one message from the queue (long poll 5s). Returns parsed body or null.
 * When the queue is subscribed to SNS, the SQS Body is an SNS envelope with our payload in Message (string);
 * we unwrap so body is the actual published event.
 */
export async function receiveOneMessageFromQueue<T = unknown>(
  queueUrl: string
): Promise<{ body: T; receiptHandle: string } | null> {
  const sqs = sqsClient();
  const result = await sqs.send(
    new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 1,
      WaitTimeSeconds: 5,
      AttributeNames: ["All"],
    })
  );
  const msg = result.Messages?.[0];
  if (!msg?.Body) return null;
  const parsed = JSON.parse(msg.Body) as Record<string, unknown>;
  // SNS->SQS: envelope has Message (string) containing our JSON
  const body =
    typeof parsed.Message === "string"
      ? (JSON.parse(parsed.Message as string) as T)
      : (parsed as T);
  return {
    body,
    receiptHandle: msg.ReceiptHandle!,
  };
}

export function setTestEnvVars(overrides: {
  billingEventsTopicArn?: string;
  entitlementUpdatesTopicArn?: string;
} = {}): void {
  process.env.PRODUCTS_TABLE = "products-test";
  process.env.PRICES_TABLE = "prices-test";
  process.env.ENTITLEMENTS_TABLE = "entitlements-test";
  process.env.DUNNING_TABLE = "dunning-test";
  process.env.TRANSACTIONS_TABLE = "transactions-test";
  process.env.TRIALS_TABLE = "trials-test";
  process.env.PROCESSED_EVENTS_TABLE = "processed-events-test";
  process.env.BILLING_EVENTS_TOPIC_ARN =
    overrides.billingEventsTopicArn ??
    "arn:aws:sns:us-east-1:000000000000:billing-events-test";
  process.env.ENTITLEMENT_UPDATES_TOPIC_ARN =
    overrides.entitlementUpdatesTopicArn ??
    "arn:aws:sns:us-east-1:000000000000:entitlement-updates-test";
  process.env.ENVIRONMENT = "test";
  process.env.AWS_REGION = "us-east-1";
  process.env.NODE_ENV = "test";
}

export const TABLE_NAMES = {
  products: "products-test",
  prices: "prices-test",
  entitlements: "entitlements-test",
  dunning: "dunning-test",
  transactions: "transactions-test",
  trials: "trials-test",
  processedEvents: "processed-events-test",
};

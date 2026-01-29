# Usage Event Service

Processes entitlement usage events from an SQS queue. Each message describes a consumption event (userId, entitlement key, amount). The service updates the user's entitlement usage in DynamoDB (lazy reset if needed, then consume).

## Overview

- **Input**: SQS queue (pull/batch); no API Gateway.
- **Output**: Updates the shared entitlements DynamoDB table (managed by access-service).
- **Batch**: Lambda is triggered by SQS with batch size 20; failed messages are reported for retry/DLQ.

## Message Format

Send JSON messages to the usage-event queue with the following shape:

```json
{
  "userId": "user-123",
  "entitlementKey": "AI_TUTOR_ACCESS",
  "amount": 1,
  "idempotencyKey": "optional-unique-key",
  "metadata": { "resourceId": "session-456" }
}
```

| Field             | Required | Type     | Description |
|-------------------|----------|----------|-------------|
| `userId`          | Yes      | string   | User who consumed the entitlement |
| `entitlementKey`  | Yes      | string   | Entitlement key (e.g. `ACCESS_DASHBOARD`, `AI_TUTOR_ACCESS`) |
| `amount`          | No       | number   | Usage amount (default `1`) |
| `idempotencyKey`  | No       | string   | Optional idempotency key (for future dedup) |
| `metadata`        | No       | object   | Optional metadata |

## How to Attach to the SQS Queue and Push Messages

### 1. Get the queue URL/ARN

After deploying the usage-event-service Terraform:

- **Queue URL** (for sending from AWS SDK or CLI):  
  Terraform output `usage_event_queue_url`, or in AWS Console: SQS → queue named `{project}-{env}-usage-event-queue`.
- **Queue ARN**:  
  Terraform output `usage_event_queue_arn` (needed for IAM policies).

### 2. IAM: Allow your producer to send messages

Any principal in the same AWS account can send to the queue (queue policy allows `sqs:SendMessage` with `aws:SourceAccount`). Ensure the producer’s IAM role or user has:

```json
{
  "Effect": "Allow",
  "Action": "sqs:SendMessage",
  "Resource": "<usage_event_queue_arn>"
}
```

### 3. Push messages (AWS SDK v3 – Node.js)

```javascript
const { SQSClient, SendMessageCommand, SendMessageBatchCommand } = require("@aws-sdk/client-sqs");

const client = new SQSClient({ region: "us-east-1" });
const queueUrl = process.env.USAGE_EVENT_QUEUE_URL; // e.g. from Terraform output

// Single message
await client.send(new SendMessageCommand({
  QueueUrl: queueUrl,
  MessageBody: JSON.stringify({
    userId: "user-123",
    entitlementKey: "AI_TUTOR_ACCESS",
    amount: 1,
    metadata: { feature: "chat" },
  }),
}));

// Batch (up to 10 per request)
await client.send(new SendMessageBatchCommand({
  QueueUrl: queueUrl,
  Entries: [
    { Id: "1", MessageBody: JSON.stringify({ userId: "u1", entitlementKey: "KEY_A", amount: 1 }) },
    { Id: "2", MessageBody: JSON.stringify({ userId: "u2", entitlementKey: "KEY_B", amount: 2 }) },
  ],
}));
```

### 4. Push messages (AWS CLI)

```bash
aws sqs send-message \
  --queue-url "https://sqs.us-east-1.amazonaws.com/ACCOUNT_ID/PROJECT-env-usage-event-queue" \
  --message-body '{"userId":"user-123","entitlementKey":"AI_TUTOR_ACCESS","amount":1}'
```

### 5. Attaching other services (Lambda, API, etc.)

- **Lambda**: Grant the Lambda’s execution role `sqs:SendMessage` on the usage-event queue ARN; pass the queue URL as an environment variable and use `SendMessageCommand` / `SendMessageBatchCommand` in the handler.
- **API / Backend**: Use the same IAM + SDK pattern; store the queue URL in config/env and send after validating the user and entitlement.

See [docs/usage-events-sqs.md](../../docs/usage-events-sqs.md) for more detail and examples.

## Environment Variables

| Variable             | Description |
|----------------------|-------------|
| `ENTITLEMENTS_TABLE` | DynamoDB table name for entitlements (from access-service) |

## Behaviour

- **Lazy reset**: Before applying usage, the service checks if the entitlement’s usage should reset (e.g. new period). If so, it resets and then applies the consume.
- **Consume**: `entitlement.usage.consume(amount)` is called; if the user would exceed their limit, the use case throws and the message is reported as a batch item failure (SQS retries / DLQ).
- **Idempotency**: `idempotencyKey` is accepted in the payload; server-side deduplication is not implemented yet (duplicate messages may be applied multiple times).

## Build and deploy

- `npm run build` then `npm run package` (produces `function.zip`).
- Deploy Terraform under `infra/services/usage-event-service` (after access-service so that entitlements table exists). Lambda is triggered by the SQS queue with batch size 20 and `ReportBatchItemFailures`.

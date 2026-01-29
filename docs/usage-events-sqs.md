# Usage Events SQS: Attach and Push Messages

This document describes how to attach to the usage-event-service SQS queue and push entitlement usage events so they are processed and applied to user entitlements.

## Queue details

- **Purpose**: Entitlement usage events (userId, entitlement key, usage amount).
- **Consumer**: usage-event-service Lambda (batch of 20, DLQ on failure).
- **Producer**: Any service in the same AWS account that has `sqs:SendMessage` on the queue (e.g. API backend, another Lambda, worker).

After deploying `infra/services/usage-event-service`:

- **Queue name**: `{project_name}-{environment}-usage-event-queue`
- **Queue URL / ARN**: Use Terraform outputs `usage_event_queue_url` and `usage_event_queue_arn`, or find the queue in the SQS console.

## Message body (JSON)

Each SQS message body must be a JSON string with at least:

```json
{
  "userId": "user-123",
  "entitlementKey": "AI_TUTOR_ACCESS",
  "amount": 1
}
```

| Field             | Required | Description |
|-------------------|----------|-------------|
| `userId`          | Yes      | User who consumed the entitlement |
| `entitlementKey`  | Yes      | Entitlement key (e.g. `AI_TUTOR_ACCESS`, `ACCESS_DASHBOARD`) |
| `amount`          | No       | Usage to add (default `1`) |
| `idempotencyKey`  | No       | Optional; for future deduplication |
| `metadata`        | No       | Optional key/value object |

Invalid messages (e.g. missing `userId` or `entitlementKey`) cause the record to fail and eventually go to the DLQ.

## IAM: Allow sending to the queue

The queue policy allows any principal in the **same AWS account** to send. Your producer still needs an IAM policy that grants `sqs:SendMessage` on this queue:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "sqs:SendMessage",
      "Resource": "arn:aws:sqs:us-east-1:ACCOUNT_ID:PROJECT-env-usage-event-queue"
    }
  ]
}
```

Attach this to the IAM role (e.g. Lambda execution role) or user used by your app.

## Pushing messages

### Node.js (AWS SDK v3)

```javascript
const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs");

const sqs = new SQSClient({ region: "us-east-1" });
const queueUrl = process.env.USAGE_EVENT_QUEUE_URL;

await sqs.send(new SendMessageCommand({
  QueueUrl: queueUrl,
  MessageBody: JSON.stringify({
    userId: "user-123",
    entitlementKey: "AI_TUTOR_ACCESS",
    amount: 1,
    metadata: { source: "api" },
  }),
}));
```

Batch (up to 10 per call):

```javascript
const { SendMessageBatchCommand } = require("@aws-sdk/client-sqs");

await sqs.send(new SendMessageBatchCommand({
  QueueUrl: queueUrl,
  Entries: [
    { Id: "1", MessageBody: JSON.stringify({ userId: "u1", entitlementKey: "KEY_A", amount: 1 }) },
    { Id: "2", MessageBody: JSON.stringify({ userId: "u2", entitlementKey: "KEY_B", amount: 2 }) },
  ],
}));
```

### AWS CLI

```bash
export QUEUE_URL="https://sqs.us-east-1.amazonaws.com/ACCOUNT_ID/PROJECT-env-usage-event-queue"

aws sqs send-message \
  --queue-url "$QUEUE_URL" \
  --message-body '{"userId":"user-123","entitlementKey":"AI_TUTOR_ACCESS","amount":1}'
```

### Terraform: Passing queue URL to another service

Output the queue URL from usage-event-service and pass it into your API or worker (e.g. as an env var):

```hcl
# In your API/worker Terraform
data "terraform_remote_state" "usage_event_service" {
  backend = "s3"
  config = {
    bucket = "${var.project_name}-${var.environment}-usage-event-service-state"
    key    = "tf-infra/${var.environment}.tfstate"
    region = "us-east-1"
  }
}

# Then use data.terraform_remote_state.usage_event_service.outputs.usage_event_queue_url
# in your Lambda env or task definition.
```

## Behaviour after send

1. Messages are processed by the usage-event-service Lambda in batches of 20.
2. For each message, the service loads the user’s entitlement by `userId` and `entitlementKey`, applies a lazy reset if the period has passed, then calls `consume(amount)`.
3. If the entitlement is missing, inactive, has no usage tracking, or would exceed the limit, the use case throws and that message is reported as a batch item failure; SQS will retry and, after max receives, send it to the DLQ.
4. Successful processing updates the entitlements table (same table used by access-service).

## DLQ

Failed messages go to `{project_name}-{environment}-usage-event-dlq`. Monitor this queue and fix or replay messages as needed (e.g. invalid payloads, missing entitlements, or over-limit usage).

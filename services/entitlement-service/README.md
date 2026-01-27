# Entitlement Service

A serverless Lambda function service that processes billing events from SQS to automatically manage user entitlements. This service creates entitlements when subscriptions/payments succeed, revokes them on cancellation/expiration, handles add-ons, and maintains idempotency through event tracking.

## Overview

The Entitlement Service is an AWS Lambda function triggered by SQS messages containing billing events. It processes these events to automatically create, update, or revoke user entitlements based on product purchases, subscription changes, and add-on configurations.

### Features

- **Automatic Entitlement Management**: Creates/updates/revokes entitlements based on billing events
- **Idempotency**: Tracks processed events to prevent duplicate processing
- **Add-on Support**: Handles add-on products that increase limits or add features
- **Batch Processing**: Processes multiple events from SQS in batches
- **Dead Letter Queue**: Failed events are sent to DLQ for manual review
- **Event Publishing**: Publishes entitlement update events to SNS for other services
- **Safe Updates**: Ensures user entitlements and usage are updated safely

## Architecture

```
Billing Events → SNS Topic (billing-events) 
                    ↓
                SQS Queue (entitlement-queue)
                    ↓
            Lambda Function (Batch Processing)
                    ↓
        ┌───────────┴───────────┐
        ↓                       ↓
  Entitlements Table    Processed Events Table
        ↓                       ↓
  Entitlement Updates SNS Topic
```

## Environment Variables

The service requires the following environment variables:

### Required

- `PRODUCTS_TABLE` - Name of the DynamoDB table storing products
- `ENTITLEMENTS_TABLE` - Name of the DynamoDB table storing entitlements
- `PROCESSED_EVENTS_TABLE` - Name of the DynamoDB table for idempotency tracking
- `ENTITLEMENT_UPDATES_TOPIC_ARN` - ARN of the SNS topic for publishing entitlement updates

### Example `.env` file

```bash
# DynamoDB Configuration
PRODUCTS_TABLE={project-name}-dev-products
ENTITLEMENTS_TABLE={project-name}-dev-entitlements
PROCESSED_EVENTS_TABLE={project-name}-dev-entitlement-events

# SNS Configuration
ENTITLEMENT_UPDATES_TOPIC_ARN=arn:aws:sns:us-east-1:123456789012:{project-name}-dev-entitlement-updates

# AWS Configuration (if running locally)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
```

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- AWS CLI configured
- DynamoDB tables created (products, entitlements, processed events)
- SNS topics created (billing-events, entitlement-updates)
- SQS queue created and subscribed to billing-events SNS

### Installation

```bash
# Install dependencies
npm install
```

### Building the Service

```bash
# Build TypeScript to JavaScript
npm run build

# Build in watch mode
npm run build:watch

# Type check without building
npm run type-check

# Clean build artifacts
npm run clean
```

### Packaging for Deployment

```bash
# Package the service for Lambda deployment
npm run package

# This creates function.zip in the service root
```

## Event Processing

### Processed Events

The service processes the following billing events:

- **`subscription.created`** → Creates entitlements from product, processes add-ons
- **`subscription.updated`** → Updates entitlements (handles add-on changes)
- **`subscription.canceled`** → Revokes at period end if `cancelAtPeriodEnd=true`, else immediately
- **`subscription.expired`** → Revokes entitlements immediately
- **`subscription.paused`** → Logs pause (entitlements remain active)
- **`subscription.resumed`** → Re-activates entitlements
- **`payment.successful`** → Creates entitlements for one-off purchases

### Filtered Out Events

These events are skipped (no entitlement changes):

- **`payment.failed`** → No action
- **`payment.action_required`** → No action

## Idempotency

The service maintains idempotency by tracking processed events in a DynamoDB table:

- **Table**: `{project-name}-{env}-entitlement-events`
- **Key**: `eventId` (from billing event metadata)
- **TTL**: 30 days (automatic cleanup)
- **Status**: `success`, `failed`, or `skipped`

If an event is already processed, it's skipped to prevent duplicate entitlement changes.

## Entitlement Creation Logic

When processing a billing event:

1. **Check Idempotency**: Verify event hasn't been processed
2. **Get Product**: Fetch product details including entitlements, usage limits, and add-ons
3. **Create/Update Entitlements**: 
   - For each product entitlement, create or update user entitlement
   - Sync usage limits from product to entitlement
   - Set expiration based on subscription period or product config
4. **Process Add-ons**: 
   - Handle add-on products that increase limits or add features
   - Respect dependencies and conflicts
5. **Publish Events**: Emit entitlement update events to SNS

## Add-on Processing

Add-ons are processed based on product configuration:

- **Limit Increases**: Updates existing entitlement limits (additive)
- **New Features**: Creates new entitlements for additional features
- **Dependencies**: Ensures required add-ons are processed first
- **Conflicts**: Prevents conflicting add-ons from being active simultaneously

## Expiration Logic

- **Subscriptions**: Expires at `currentPeriodEnd` date
- **Canceled (at period end)**: Expires at `currentPeriodEnd`
- **Canceled (immediate)**: Revoked immediately
- **One-off Purchases**: Lifetime (no expiration) unless product specifies

## Error Handling

- **Partial Batch Failures**: Individual record failures don't fail the entire batch
- **DLQ**: Failed events (after 3 retries) are sent to Dead Letter Queue
- **Idempotency Tracking**: Failed events are marked in the processed events table
- **Event Publishing**: Publishing failures don't fail the main process

## Terraform Infrastructure

The service is deployed using Terraform with the following resources:

- **SNS Topics**:
  - `billing-events` (input) - For other services to publish billing events
  - `entitlement-updates` (output) - For other services to subscribe to entitlement changes
- **SQS Queue**: `entitlement-queue` with DLQ
- **Lambda Function**: Triggered by SQS with batch processing
- **DynamoDB Table**: `processed-events` for idempotency tracking
- **IAM Role**: Permissions for DynamoDB, SNS, and SQS

## Deployment

### Terraform Deployment

```bash
cd infra/services/entitlement-service
terraform init \
  -backend-config="bucket={project-name}-{environment}-entitlement-service-state" \
  -backend-config="key=tf-infra/{environment}.tfstate" \
  -backend-config="region=us-east-1" \
  -backend-config="dynamodb_table={project-name}-{environment}-entitlement-service-state-locking" \
  -backend-config="encrypt=true"

terraform apply \
  -var="project_name={project-name}" \
  -var="environment={environment}" \
  -var="state_bucket_name={state-bucket}" \
  -var="state_region=us-east-1" \
  -var="state_bucket_key={state-key}"
```

### CI/CD Deployment

The service is automatically deployed via GitHub Actions when changes are pushed. The workflow:

1. Builds the service
2. Packages it into `function.zip`
3. Bootstraps Terraform backend
4. Deploys infrastructure using Terraform

## Publishing Billing Events

Other services can publish billing events to the `billing-events` SNS topic:

```typescript
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

const sns = new SNSClient({});
const topicArn = process.env.BILLING_EVENTS_TOPIC_ARN;

await sns.send(new PublishCommand({
  TopicArn: topicArn,
  Message: JSON.stringify({
    type: "subscription.created",
    payload: {
      subscriptionId: "sub_123",
      userId: "user_456",
      productId: "prod_789",
      priceId: "price_abc",
      status: "active",
      currentPeriodStart: "2024-01-01T00:00:00Z",
      currentPeriodEnd: "2024-02-01T00:00:00Z"
    },
    meta: {
      eventId: "evt_unique_id",
      occurredAt: new Date().toISOString(),
      source: "internal"
    },
    version: 1
  })
}));
```

## Subscribing to Entitlement Updates

Other services can subscribe to the `entitlement-updates` SNS topic to receive notifications when entitlements change:

```bash
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:123456789012:{project-name}-dev-entitlement-updates \
  --protocol sqs \
  --notification-endpoint arn:aws:sqs:us-east-1:123456789012:your-queue
```

## Monitoring

### CloudWatch Logs

The service logs:
- Incoming SQS events
- Idempotency checks
- Entitlement creation/updates
- Add-on processing
- Event publishing status
- Errors with full stack traces

### Metrics

Monitor:
- Lambda invocation count
- Lambda error rate
- Lambda duration
- SQS queue depth
- DLQ message count
- DynamoDB read/write capacity

## Troubleshooting

### Events Not Processing

1. Check SQS queue has messages
2. Verify Lambda is triggered (check CloudWatch logs)
3. Check idempotency table for processed events
4. Verify DynamoDB permissions

### Entitlements Not Created

1. Verify product exists in products table
2. Check product has entitlements defined
3. Verify user ID is correct in event payload
4. Check CloudWatch logs for errors

### Duplicate Processing

1. Check idempotency table for event ID
2. Verify `eventId` is unique in billing events
3. Check TTL on processed events table

## Related Services

- **Product Service**: Manages products and their configurations
- **Access Service**: Provides API to query user entitlements
- **Pricing Service**: Manages pricing for products

## License

ISC

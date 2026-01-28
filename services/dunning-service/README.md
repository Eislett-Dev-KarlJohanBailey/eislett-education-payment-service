# Dunning Service

A serverless Lambda function service for managing billing issues and payment recovery. This service implements a progressive dunning workflow that maintains user access during grace periods and only suspends accounts after multiple days of unresolved payment issues.

## Overview

The Dunning Service processes billing events (payment failures, action required) and manages a state machine that transitions users through different dunning states based on time elapsed. It ensures users have adequate time to resolve payment issues before access is revoked.

### Features

- **Progressive Dunning Workflow**: Implements a 4-stage timeline (ACTION_REQUIRED → GRACE_PERIOD → RESTRICTED → SUSPENDED)
- **Billing Issue Detection**: Listens to `payment_intent.requires_action` and `invoice.payment_failed` events
- **Portal URL Generation**: Automatically generates Stripe Customer Portal URLs for resolving billing issues
- **State Transitions**: Automatically transitions states based on days since detection
- **Access Management**: Only revokes access when state reaches SUSPENDED (Day 8+)
- **Recovery Support**: Automatically resolves billing issues when payment succeeds or subscription becomes active
- **API Endpoint**: Provides endpoint to check user's current billing issue status

## Architecture

The service follows a clean architecture pattern:

```
src/
├── app/                    # Application layer
│   ├── controllers/        # API Gateway request handlers
│   └── usecases/          # Business logic
├── handler/                # Lambda handlers
│   ├── api-gateway/       # API Gateway handler
│   └── sqs/               # SQS event parser
├── infrastructure/         # Infrastructure layer
│   └── event.publisher.ts  # SNS event publisher
└── bootstrap.ts           # Dependency injection
```

## Dunning Timeline

### Day 0 – Failure Detected (ACTION_REQUIRED)

**Triggers:**
- `payment_intent.requires_action`
- `invoice.payment_failed`

**Actions:**
- Set dunning state → `ACTION_REQUIRED`
- Generate Stripe Portal Session URL
- Store `portal_url` and `expires_at`
- Notify user immediately

**Access:** ✅ Full access maintained

### Day 1–3 – Grace Period (GRACE_PERIOD)

**If unresolved after 24h:**
- State → `GRACE_PERIOD`
- Send reminder email / in-app banner
- Regenerate portal URL on demand

**Access:** ✅ Full access maintained (warning banners only)

### Day 4–7 – Soft Restriction (RESTRICTED)

**If still unresolved:**
- State → `RESTRICTED`
- Limit premium actions:
  - No new uploads
  - No new quizzes
  - Keep read-only access

**Access:** ⚠️ Limited access (premium features disabled)

**Communication:**
- Stronger messaging
- "Your account will be suspended in X days"

### Day 8+ – Suspension (SUSPENDED)

**If unresolved:**
- State → `SUSPENDED`
- Publish `entitlement.revoked` event with reason `non_payment`
- Lock premium features
- Revoke all entitlements

**Access:** ❌ Access revoked (account still recoverable)

### Recovery (Any Time)

**Triggers:**
- `invoice.paid`
- `subscription.updated` → status `active`
- `payment.successful`

**Actions:**
- State → `OK`
- Restore entitlements
- Send "We're back" notification

## Environment Variables

### Required

- `DUNNING_TABLE` - Name of the DynamoDB table storing dunning records
- `ENTITLEMENT_UPDATES_TOPIC_ARN` - ARN of the SNS topic for publishing entitlement revocation events

### Optional

- `ENTITLEMENTS_TABLE` - Name of the entitlements DynamoDB table (for direct revocation when suspending)
- `JWT_ACCESS_TOKEN_SECRET` - JWT secret for API Gateway authentication (for API endpoint)
- `PORTAL_RETURN_URL` - Return URL for Stripe Customer Portal (defaults to `https://app.is-ed.com/billing`)

## API Endpoints

### Get Billing Issue

```
GET /v1/dunning/billing-issue
```

**Authentication:** Required (Bearer token)

**Response:**
```json
{
  "hasIssue": true,
  "state": "action_required",
  "message": "Payment action required. Please update your payment method to continue.",
  "portalUrl": "https://billing.stripe.com/p/session/...",
  "expiresAt": "2024-01-15T12:00:00.000Z",
  "daysSinceDetection": 0,
  "actions": [
    "Update your payment method using the portal link",
    "Contact support if you need assistance"
  ]
}
```

**States:**
- `ok` - No billing issues
- `action_required` - Payment action required (Day 0)
- `grace_period` - Grace period (Day 1-3)
- `restricted` - Restricted access (Day 4-7)
- `suspended` - Account suspended (Day 8+)

## Event Processing

The service processes the following billing events:

- **`payment.action_required`** → Sets state to `ACTION_REQUIRED`
- **`payment.failed`** → Sets state to `ACTION_REQUIRED`
- **`payment.successful`** → Resolves billing issue (state → `OK`)
- **`subscription.updated`** → Resolves if subscription status is `active`

## State Transitions

States automatically transition based on days since detection:

- `ACTION_REQUIRED` → `GRACE_PERIOD` (after 1 day)
- `GRACE_PERIOD` → `RESTRICTED` (after 4 days total)
- `RESTRICTED` → `SUSPENDED` (after 8 days total)

State transitions are checked:
- When processing billing events
- When querying billing issue status via API

## Integration with Entitlement Service

The entitlement service is updated to:
- **Check dunning state** before revoking entitlements
- **Skip revocation** if dunning state is `ACTION_REQUIRED`, `GRACE_PERIOD`, or `RESTRICTED`
- **Only revoke** when dunning state is `OK` (normal cancellation) or `SUSPENDED` (non-payment)

This ensures entitlements are maintained during the dunning grace period and only revoked when the account is actually suspended.

## DynamoDB Table Schema

**Table Name:** `{project-name}-{environment}-dunning`

**Primary Key:**
- `userId` (Partition Key): User ID

**Attributes:**
- `state` (String): Current dunning state
- `portalUrl` (String, optional): Stripe Customer Portal URL
- `expiresAt` (String, optional): ISO 8601 timestamp when payment/action expires
- `detectedAt` (String): ISO 8601 timestamp when billing issue was first detected
- `lastUpdatedAt` (String): ISO 8601 timestamp of last update
- `paymentIntentId` (String, optional): Stripe payment intent ID
- `invoiceId` (String, optional): Stripe invoice ID
- `subscriptionId` (String, optional): Stripe subscription ID
- `failureCode` (String, optional): Payment failure code
- `failureReason` (String, optional): Payment failure reason

## Deployment

The service is deployed using Terraform with:
- DynamoDB table for dunning records
- SQS queue subscribed to billing events SNS topic
- Lambda function for SQS event processing
- Lambda function for API Gateway
- API Gateway integration

## Related Services

- **Stripe Service**: Publishes billing events to SNS
- **Entitlement Service**: Checks dunning state before revoking entitlements
- **Access Service**: Provides entitlements table for direct revocation

## License

ISC

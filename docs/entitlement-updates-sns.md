# Entitlement Updates SNS Topic

The **Entitlement Updates** SNS topic publishes a message whenever a user’s entitlement **availability** changes: usage increases or decreases, limits change, or usage resets. Subscribers can use these events to sync caches, send notifications, or drive downstream systems.

## Infrastructure

- **Topic owner**: access-service (Terraform: `infra/services/access-service/main.tf`).
- **Topic name**: `{project_name}-{environment}-entitlement-updates`.
- **Publishers** (services that write to this topic):
  - **access-service** – after incrementing usage (`POST /access/usage/:key`).
  - **entitlement-service** – after billing-driven entitlement updates and limit syncs.
  - **usage-event-service** – after consuming usage from SQS.
  - **token-service** – after charging tokens and syncing product limits.
  - **trial-service** – after starting a trial and updating entitlements.

Publishing is best-effort: failures are logged and do not fail the main flow.

## Event type

- **Type**: `entitlement.availability_updated`
- **Canonical value**: `EntitlementEventType.ENTITLEMENT_AVAILABILITY_UPDATED` = `"entitlement.availability_updated"`.

## Message shape

Each message is a JSON object with:

| Field     | Type   | Description |
|----------|--------|-------------|
| `type`   | string | `"entitlement.availability_updated"` |
| `payload`| object | See below |
| `meta`   | object | `eventId`, `occurredAt` (ISO), `source` (e.g. `"internal"`) |
| `version`| number | `1` |

### Payload

| Field                  | Type           | Description |
|------------------------|----------------|-------------|
| `userId`               | string         | User that owns the entitlement |
| `key`                  | string         | Entitlement key (e.g. `"token"`, `"subject_access"`) |
| `currentAvailableUsage` | number \| null | **Remaining** usage: `limit - used`. `null` if the entitlement is not usage-based. |

### Example (usage-based)

```json
{
  "type": "entitlement.availability_updated",
  "payload": {
    "userId": "user_abc123",
    "key": "token",
    "currentAvailableUsage": 42
  },
  "meta": {
    "eventId": "550e8400-e29b-41d4-a716-446655440000",
    "occurredAt": "2025-03-14T12:00:00.000Z",
    "source": "internal"
  },
  "version": 1
}
```

### Example (non–usage-based)

When the entitlement has no usage (e.g. boolean access), `currentAvailableUsage` is `null`:

```json
{
  "type": "entitlement.availability_updated",
  "payload": {
    "userId": "user_abc123",
    "key": "subject_access",
    "currentAvailableUsage": null
  },
  "meta": {
    "eventId": "...",
    "occurredAt": "2025-03-14T12:00:00.000Z",
    "source": "internal"
  },
  "version": 1
}
```

## When events are published

- **Usage consumed** (increment usage, token charge, usage-event processing): after the entitlement is updated, so `currentAvailableUsage` reflects the new remaining amount.
- **Limit changed** (subscription, add-on, one-time purchase, sync): after limits or permanent limits are updated.
- **Usage reset** (periodic or billing reset): after the reset is applied.

Subscribers can filter by `key` or `userId` (e.g. SNS subscription filter policies or in-app) to only handle relevant entitlements.

## Subscribing to the topic

- **SQS**: Subscribe an SQS queue to the topic (e.g. for reliable processing and retries).
- **Lambda**: Use the topic as a Lambda event source.
- **HTTP/S**: Use an SNS subscription with protocol `https` (your endpoint must confirm the subscription).

IAM: the topic is in the access-service stack; other stacks that need to subscribe use the topic ARN from access-service outputs (e.g. `data.terraform_remote_state.access_service.outputs.entitlement_updates_topic_arn`).

## Related

- Billing/entitlement lifecycle events (created, updated, revoked) are published to the **Billing Events** topic by entitlement-service; see billing and subscription docs.
- Usage consumption can also be driven by the **Usage Events** SQS queue; see `docs/usage-events-sqs.md`.

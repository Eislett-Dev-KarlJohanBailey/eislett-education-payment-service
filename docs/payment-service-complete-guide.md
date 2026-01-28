# Payment Service Complete Guide

## Table of Contents

1. [Business Overview](#business-overview)
2. [Product Types & Pricing](#product-types--pricing)
3. [Usage Limits & Tracking](#usage-limits--tracking)
4. [Reset Strategies](#reset-strategies)
5. [One-Time Payments vs Subscriptions](#one-time-payments-vs-subscriptions)
6. [Add-Ons & Product Combinations](#add-ons--product-combinations)
7. [Payment Failures & Dunning Process](#payment-failures--dunning-process)
8. [Entitlements & Access Control](#entitlements--access-control)
9. [Technical Architecture](#technical-architecture)
10. [Event System](#event-system)
11. [API Reference](#api-reference)
12. [Integration Guide](#integration-guide)

---

## Business Overview

### What is the Payment Service?

The Payment Service is a comprehensive billing and entitlement management system that handles:
- **Product Catalog**: Define products with features, usage limits, and pricing
- **Payment Processing**: Handle one-time payments and recurring subscriptions
- **Access Control**: Manage user entitlements and feature access
- **Usage Tracking**: Monitor and limit feature usage (API calls, storage, etc.)
- **Payment Recovery**: Automatically handle payment failures with a grace period
- **Flexible Pricing**: Support for subscriptions, one-time purchases, and add-ons

### Key Concepts

**Products** are the items you sell (e.g., "Premium Plan", "API Credits", "Storage Upgrade")

**Prices** define how much a product costs and how often it's charged (one-time or recurring)

**Entitlements** are the features or capabilities a user gains access to (e.g., "premium_features", "api_calls")

**Usage Limits** control how much of a feature a user can consume (e.g., "1000 API calls per month")

**Subscriptions** provide recurring access that renews automatically

**One-Time Payments** provide permanent access that never expires

**Add-Ons** are additional products that enhance base subscriptions

---

## Product Types & Pricing

### Product Types

#### 1. **Base Product** (`type: "product"`)
A standalone product that can be purchased independently. Examples:
- "Monthly Premium Plan"
- "Annual Enterprise License"
- "One-Time API Credits"

#### 2. **Add-On Product** (`type: "addon"`)
An additional product that enhances a base subscription. Examples:
- "Extra Storage" (adds 100GB to base plan)
- "API Boost" (adds 5000 API calls to base plan)
- "Priority Support" (adds priority ticket handling)

**Key Difference**: Add-ons are designed to be purchased alongside base products and their limits are **added** to base product limits, not replaced.

### Pricing Models

#### One-Time Payments (`billingType: "one_time"`)

**What it is**: A single payment that grants permanent access.

**Best for**:
- Lifetime licenses
- One-off credits that never expire
- Permanent feature unlocks
- Credits that accumulate over time

**Characteristics**:
- ✅ No expiration date - access is permanent
- ✅ Limits accumulate with each purchase
- ✅ Cannot be canceled (already paid)
- ✅ Survives subscription cancellations

**Example**: User buys "1000 API Credits" three times → Has 3000 permanent credits forever.

#### Recurring Subscriptions (`billingType: "recurring"`)

**What it is**: Automatic recurring charges (monthly, yearly, etc.).

**Best for**:
- Ongoing access to features
- Usage limits that reset periodically
- Time-limited access
- Predictable recurring revenue

**Characteristics**:
- ⏰ Expires when subscription ends
- 🔄 Limits reset based on reset strategy
- ❌ Can be canceled (access ends at period end)
- 💳 Automatically renews unless canceled

**Example**: User subscribes to "5000 API calls/month" → Gets 5000 calls, resets each month, renews automatically.

### Billing Intervals

Subscriptions support various billing intervals:

- **Daily**: Charges every day
- **Weekly**: Charges every week
- **Monthly**: Charges every month (most common)
- **Yearly**: Charges once per year
- **Custom Frequency**: e.g., every 2 months, every 3 months

**Frequency Examples**:
- `interval: "month"`, `frequency: 1` = Monthly
- `interval: "month"`, `frequency: 2` = Bi-monthly (every 2 months)
- `interval: "month"`, `frequency: 3` = Quarterly (every 3 months)
- `interval: "month"`, `frequency: 6` = Semi-annually (every 6 months)

---

## Usage Limits & Tracking

### What are Usage Limits?

Usage limits control how much of a feature a user can consume. They're defined per entitlement key and can have different reset behaviors.

### Limit Structure

Each usage limit has:
- **Metric**: The entitlement key being tracked (e.g., "api_calls", "storage_gb")
- **Limit**: The maximum amount allowed
- **Period**: When/how the limit resets (see Reset Strategies below)

### How Limits Work

#### Simple Entitlements (No Usage)

Some entitlements are simple boolean flags with no usage tracking:
- User either has access or doesn't
- No consumption tracking
- Examples: "premium_features", "advanced_analytics"

#### Usage-Based Entitlements

Entitlements with usage tracking:
- Track how much has been consumed
- Enforce limits (prevent over-consumption)
- Reset based on strategy
- Examples: "api_calls", "storage_gb", "email_sends"

### Limit Types

#### 1. **Regular Limits** (from Subscriptions)
- Stored in `limit` field
- Reset based on reset strategy
- Removed when subscription ends
- Example: "5000 API calls/month" from subscription

#### 2. **Permanent Limits** (from One-Time Payments)
- Stored in `permanentLimit` field
- Never reset
- Never removed (even if subscription canceled)
- Accumulate with each purchase
- Example: "1000 API calls" bought 3 times = 3000 permanent calls

#### 3. **Effective Limit** (Combined)
- Formula: `effectiveLimit = limit + permanentLimit`
- User can consume from both
- Example: 5000 (subscription) + 3000 (one-time) = 8000 total calls

### Usage Consumption

When a user consumes a feature:
1. System checks: `used + amount <= effectiveLimit`
2. If allowed: `used += amount`
3. If denied: Error thrown (usage exceeded)

**Example Flow**:
```
User has: limit=5000, permanentLimit=3000, used=2000
Effective limit: 8000
User makes API call: used becomes 2001
User makes 6000 more calls: used becomes 8001 → ERROR (exceeded)
```

---

## Reset Strategies

Reset strategies determine when and how usage limits reset. They're critical for managing recurring subscriptions.

### Available Reset Strategies

#### 1. **Billing Cycle** (`period: "billing_cycle"`)

**What it does**: Resets usage when subscription renews.

**Best for**: Subscription-based limits that reset monthly/yearly.

**Behavior**:
- Resets on subscription renewal
- Tied to subscription period end
- Most common for subscription products

**Example**: "5000 API calls/month" → Resets on the 1st of each month when subscription renews.

#### 2. **Daily** (`period: "day"`)

**What it does**: Resets usage every day at a specific hour.

**Best for**: Daily quotas, rate limiting.

**Behavior**:
- Resets at midnight (or specified hour) every day
- Independent of subscription billing
- Useful for daily rate limits

**Example**: "100 API calls/day" → Resets at midnight each day.

#### 3. **Weekly** (`period: "week"`)

**What it does**: Resets usage every week on a specific day.

**Best for**: Weekly quotas.

**Behavior**:
- Resets on specified day of week (e.g., Sunday)
- Independent of subscription billing
- Useful for weekly limits

**Example**: "1000 API calls/week" → Resets every Sunday.

#### 4. **Monthly** (`period: "month"`)

**What it does**: Resets usage on a specific day each month.

**Best for**: Monthly quotas independent of billing.

**Behavior**:
- Resets on specified day of month (e.g., 1st)
- Independent of subscription billing
- Useful when billing cycle ≠ usage cycle

**Example**: "5000 API calls/month" → Resets on the 1st of each month (even if billing is on 15th).

#### 5. **Yearly** (`period: "year"`)

**What it does**: Resets usage once per year.

**Best for**: Annual quotas.

**Behavior**:
- Resets on specified date each year
- Independent of subscription billing
- Rarely used

**Example**: "100,000 API calls/year" → Resets on January 1st.

#### 6. **Lifetime** (`period: "lifetime"`)

**What it does**: Never resets - limits accumulate.

**Best for**: One-time purchases, permanent credits.

**Behavior**:
- Never resets
- Limits accumulate with each purchase
- Always increments (never overwrites)

**Example**: "1000 API Credits" → Bought 5 times = 5000 credits forever.

#### 7. **Manual** (`type: "manual"`)

**What it does**: Only resets when explicitly triggered.

**Best for**: Admin-controlled resets, special cases.

**Behavior**:
- No automatic reset
- Requires manual intervention
- Useful for special promotions or adjustments

### Reset Strategy Selection Guide

| Use Case | Recommended Strategy |
|----------|---------------------|
| Subscription monthly limits | `billing_cycle` |
| Subscription yearly limits | `billing_cycle` |
| Daily rate limits | `day` |
| Weekly quotas | `week` |
| Monthly quotas (independent of billing) | `month` |
| One-time purchases | `lifetime` |
| Permanent credits | `lifetime` |
| Admin-controlled | `manual` |

### Reset Behavior Examples

#### Example 1: Billing Cycle Reset
```
Product: "Monthly API Plan"
Limit: 5000 API calls
Reset: billing_cycle
Billing: Monthly (renews on 15th)

Day 1 (Jan 15): User gets 5000 calls, uses 2000
Day 15 (Feb 15): Subscription renews → Usage resets to 0, gets 5000 new calls
```

#### Example 2: Daily Reset
```
Product: "Daily API Quota"
Limit: 100 API calls
Reset: day (midnight)

Jan 15, 10:00 AM: User uses 50 calls (50 remaining)
Jan 15, 11:59 PM: User uses 30 calls (20 remaining)
Jan 16, 12:00 AM: Usage resets → 100 calls available
```

#### Example 3: Lifetime Accumulation
```
Product: "API Credits" (one-time)
Limit: 1000 API calls
Reset: lifetime

Purchase 1: User gets 1000 calls (permanentLimit: 1000)
Purchase 2: User gets 1000 more (permanentLimit: 2000)
Purchase 3: User gets 1000 more (permanentLimit: 3000)
→ User has 3000 permanent calls forever
```

---

## One-Time Payments vs Subscriptions

### Comparison Table

| Feature | One-Time Payment | Subscription |
|---------|-----------------|--------------|
| **Expiration** | Never expires | Expires when subscription ends |
| **Limit Storage** | `permanentLimit` | `limit` |
| **Limit Behavior** | Accumulates | Resets based on strategy |
| **Cancellation** | Cannot cancel (already paid) | Can cancel (access ends at period end) |
| **Removal** | Never removed | Removed when subscription ends |
| **Combined Access** | Survives subscription cancellation | Removed on cancellation |
| **Best For** | Permanent credits, lifetime access | Ongoing access, resettable limits |

### Combined Access Scenarios

Users can have both one-time purchases and subscriptions for the same entitlement.

#### Scenario 1: Base Subscription + One-Time Credits

```
User has:
- Subscription: "5000 API calls/month" (limit: 5000)
- One-time purchase: "1000 API Credits" (permanentLimit: 1000)

Effective limit: 6000 calls
- Can use from both limits
- Subscription limit resets monthly
- Permanent limit never resets
```

#### Scenario 2: Subscription Canceled, One-Time Remains

```
User had:
- Subscription: "5000 API calls/month" (limit: 5000) - CANCELED
- One-time purchase: "1000 API Credits" (permanentLimit: 1000)

After cancellation:
- limit: 0 (subscription removed)
- permanentLimit: 1000 (one-time remains)
- Effective limit: 1000 calls (still has access!)
```

#### Scenario 3: Multiple One-Time Purchases

```
User buys "1000 API Credits" three times:
- Purchase 1: permanentLimit: 1000
- Purchase 2: permanentLimit: 2000 (accumulated)
- Purchase 3: permanentLimit: 3000 (accumulated)

Result: 3000 permanent API calls forever
```

### When to Use Each

**Use One-Time Payments for**:
- ✅ Credits that should never expire
- ✅ Lifetime access to features
- ✅ One-off purchases that accumulate
- ✅ Permanent upgrades

**Use Subscriptions for**:
- ✅ Recurring access to features
- ✅ Usage limits that reset periodically
- ✅ Time-limited access
- ✅ Predictable recurring revenue

---

## Add-Ons & Product Combinations

### What are Add-Ons?

Add-ons are additional products that enhance base subscriptions. They're designed to be purchased alongside base products and their limits are **added** to base product limits.

### Add-On Behavior

#### Key Characteristics

1. **Additive Limits**: Add-on limits are **added** to base limits, not replaced
2. **Same Expiration**: Add-ons inherit the base subscription's expiration
3. **Proration**: Stripe automatically prorates add-ons when added mid-cycle
4. **Removable**: Add-ons can be removed without canceling base subscription

### Add-On Examples

#### Example 1: Storage Add-On

```
Base Subscription: "Pro Plan"
- Storage: 100GB (limit: 100)

Add-On: "Extra Storage"
- Storage: +50GB (adds to base)

Result: User has 150GB total storage
```

#### Example 2: API Calls Add-On

```
Base Subscription: "Basic Plan"
- API Calls: 1000/month (limit: 1000)

Add-On: "API Boost"
- API Calls: +5000/month (adds to base)

Result: User has 6000 API calls/month total
```

#### Example 3: Multiple Add-Ons

```
Base Subscription: "Enterprise Plan"
- API Calls: 10000/month
- Storage: 500GB

Add-On 1: "API Boost"
- API Calls: +5000/month

Add-On 2: "Storage Expansion"
- Storage: +200GB

Result:
- API Calls: 15000/month (10000 + 5000)
- Storage: 700GB (500 + 200)
```

### Add-On Purchase Flow

1. **User subscribes to base product** → Gets base limits
2. **User adds add-on** → Add-on limits are added to base limits
3. **Stripe prorates** → User pays prorated amount for add-on until next billing cycle
4. **On renewal** → Both base and add-on renew together

### Add-On Removal

When an add-on is removed:
- Add-on limits are removed from total
- Base subscription limits remain
- User keeps base subscription access
- No refund (already used the add-on for the period)

**Example**:
```
User has:
- Base: 5000 API calls
- Add-on: +2000 API calls
- Total: 7000 calls

User removes add-on:
- Base: 5000 API calls (remains)
- Add-on: removed
- Total: 5000 calls
```

### Add-On vs Separate Subscription

**Add-On** (Recommended):
- ✅ Limits are added together
- ✅ Single billing cycle
- ✅ Easier to manage
- ✅ Automatic proration

**Separate Subscription** (Not Recommended):
- ❌ Limits are separate (not combined)
- ❌ Different billing cycles
- ❌ More complex to manage
- ❌ No automatic combination

---

## Payment Failures & Dunning Process

### What is Dunning?

Dunning is the process of automatically managing payment failures and gradually restricting access when users fail to pay. It provides a grace period before fully suspending access.

### Dunning Timeline

The dunning process follows a strict 8-day timeline with 4 stages:

#### Day 0: **ACTION_REQUIRED** (Failure Detected)

**What happens**:
- Payment fails (card declined, insufficient funds, etc.)
- User is immediately notified
- Customer Portal URL is generated for payment resolution
- Access remains **fully active** (no restrictions)

**User actions**:
- Can resolve payment immediately via Customer Portal
- Can update payment method
- Can contact support

**System actions**:
- Publishes `PAYMENT_FAILED` or `PAYMENT_ACTION_REQUIRED` event
- Generates portal URL with expiration (typically 24 hours)
- Entitlements remain active

#### Days 1-3: **GRACE_PERIOD** (Warning Phase)

**What happens**:
- User still has full access
- Reminder notifications sent
- Portal URL remains available
- No restrictions applied

**User actions**:
- Can still resolve payment
- Can update payment method
- Should resolve soon to avoid restrictions

**System actions**:
- Continues to send reminders
- Maintains access
- Monitors for payment resolution

#### Days 4-7: **RESTRICTED** (Limited Access)

**What happens**:
- Access may be restricted (configurable per product)
- User can still resolve payment
- Portal URL still available
- Some features may be limited

**User actions**:
- Can still resolve payment
- May experience limited functionality
- Should resolve immediately

**System actions**:
- May restrict certain features (product-specific)
- Continues monitoring
- Maintains core access

#### Day 8+: **SUSPENDED** (Access Revoked)

**What happens**:
- All entitlements are revoked
- User loses access to paid features
- Subscription is effectively canceled
- User must resolve payment and resubscribe

**User actions**:
- Must resolve payment
- May need to resubscribe
- Can contact support for assistance

**System actions**:
- Revokes all entitlements from failed subscription
- Publishes entitlement revocation events
- Maintains permanent limits from one-time purchases

### Dunning State Transitions

```
ACTION_REQUIRED (Day 0)
    ↓
GRACE_PERIOD (Days 1-3)
    ↓
RESTRICTED (Days 4-7)
    ↓
SUSPENDED (Day 8+)
    ↓
OK (Payment Resolved) → Access Restored
```

### Payment Resolution

**At Any Time**: User can resolve payment and restore access:

1. User updates payment method via Customer Portal
2. Payment succeeds
3. System publishes `PAYMENT_SUCCESSFUL` or `INVOICE_PAID` event
4. Dunning state transitions to `OK`
5. Entitlements are restored
6. Access is immediately restored

### Dunning & Entitlements

**Critical Rule**: Entitlements are **NOT revoked** during the 8-day grace period.

- **Days 0-7**: Entitlements remain active (access maintained)
- **Day 8+**: Entitlements are revoked (access suspended)

This ensures users have time to resolve payment issues without losing access immediately.

### Permanent Limits Protection

**Important**: Permanent limits from one-time purchases are **NEVER** affected by dunning:

- One-time purchase limits remain even if subscription payment fails
- User keeps access to permanent credits/features
- Only subscription-based limits are revoked on Day 8+

**Example**:
```
User has:
- Subscription: 5000 API calls/month (fails payment)
- One-time purchase: 1000 permanent API calls

Day 0-7: User has 6000 calls (5000 + 1000)
Day 8+: User has 1000 calls (only permanent limit remains)
```

### Dunning Notifications

The system can send notifications at each stage:
- **Day 0**: Immediate payment failure notification
- **Days 1-3**: Reminder notifications
- **Days 4-7**: Warning notifications
- **Day 8+**: Suspension notification

### Customer Portal

Stripe Customer Portal provides:
- Payment method update
- Payment retry
- Invoice history
- Subscription management

Portal URL is generated automatically and included in billing events.

---

## Entitlements & Access Control

### What are Entitlements?

Entitlements are the features or capabilities a user gains access to when they purchase a product. They control what users can and cannot do in your application.

### Entitlement Structure

Each entitlement has:
- **Key**: Unique identifier (e.g., "premium_features", "api_calls")
- **Status**: `ACTIVE` or `REVOKED`
- **Expiration**: Optional date when access expires
- **Usage**: Optional usage tracking (limits, consumption, reset strategy)
- **Role**: User role (e.g., "LEARNER", "INSTRUCTOR")

### Entitlement Types

#### 1. **Simple Entitlements** (Boolean)

No usage tracking - user either has access or doesn't.

**Example**:
```json
{
  "key": "premium_features",
  "status": "ACTIVE",
  "expiresAt": null
}
```

**Use cases**:
- Feature flags
- Access to specific pages
- Permission-based features

#### 2. **Usage-Based Entitlements**

Track consumption and enforce limits.

**Example**:
```json
{
  "key": "api_calls",
  "status": "ACTIVE",
  "expiresAt": "2024-02-15T00:00:00Z",
  "usage": {
    "limit": 5000,
    "permanentLimit": 1000,
    "used": 2500,
    "resetAt": "2024-02-15T00:00:00Z",
    "resetStrategy": {
      "type": "periodic",
      "period": "billing_cycle"
    }
  }
}
```

**Use cases**:
- API call limits
- Storage quotas
- Email send limits
- Download limits

### Entitlement Lifecycle

#### Creation

Entitlements are created when:
- User purchases a product (one-time or subscription)
- Subscription is created
- Payment is successful

#### Activation

Entitlements become active when:
- Status is set to `ACTIVE`
- Current date is before expiration (if set)
- User has valid payment

#### Renewal

For subscriptions:
- Entitlements are renewed when subscription renews
- Usage may reset based on reset strategy
- Expiration date is updated to new period end

#### Revocation

Entitlements are revoked when:
- Subscription is canceled (at period end)
- Subscription expires
- Payment fails for 8+ days (dunning suspended)
- Admin manually revokes

**Important**: Permanent limits from one-time purchases are **never** revoked.

### Access Control Flow

```
User requests feature
    ↓
Check entitlement exists
    ↓
Check status is ACTIVE
    ↓
Check expiration (if set)
    ↓
Check usage limit (if usage-based)
    ↓
Grant/Deny access
```

### Entitlement Registry

The entitlement registry defines which entitlement keys are valid. It serves as a whitelist to prevent typos and ensure consistency.

**Note**: The registry doesn't prevent invalid entitlements from being created - it's primarily for documentation and validation.

---

## Technical Architecture

### System Overview

The payment service is built as a serverless microservices architecture:

```
┌─────────────────┐
│  API Gateway    │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐ ┌──▼────┐
│Stripe │ │Access │
│Service│ │Service│
└───┬───┘ └───┬───┘
    │         │
    │    ┌────▼────┐
    │    │Entitle- │
    │    │ment     │
    │    │Service  │
    │    └────┬────┘
    │         │
    └────┬────┘
         │
    ┌────▼────┐
    │  SNS    │
    │(Events) │
    └────┬────┘
         │
    ┌────▼────┐
    │ Dunning │
    │ Service │
    └─────────┘
```

### Service Responsibilities

#### Product Service
- Manages product catalog
- CRUD operations for products
- Product search and filtering

#### Pricing Service
- Manages price definitions
- Supports one-time and recurring prices
- Price lookup and listing

#### Stripe Service
- Handles Stripe integration
- Creates checkout sessions
- Processes webhooks
- Manages Stripe customers
- Generates Customer Portal URLs

#### Entitlement Service
- Processes billing events
- Creates/updates entitlements
- Syncs product limits
- Handles usage resets
- Publishes entitlement events

#### Dunning Service
- Monitors payment failures
- Manages dunning state transitions
- Publishes revocation events (Day 8+)
- Provides billing issue API

#### Access Service
- Provides entitlement lookup API
- Validates user access
- Returns user entitlements

### Data Flow

#### Subscription Creation Flow

```
1. User requests subscription
   ↓
2. Stripe Service: Create checkout session
   ↓
3. User completes payment in Stripe
   ↓
4. Stripe webhook: subscription.created
   ↓
5. Stripe Service: Publish SUBSCRIPTION_CREATED event
   ↓
6. SNS: Route to Entitlement Service queue
   ↓
7. Entitlement Service: Create entitlements
   ↓
8. Entitlement Service: Sync product limits
   ↓
9. Entitlement Service: Publish entitlement events
```

#### Payment Failure Flow

```
1. Stripe: Payment fails
   ↓
2. Stripe webhook: invoice.payment_failed
   ↓
3. Stripe Service: Publish PAYMENT_FAILED event
   ↓
4. SNS: Route to Dunning Service queue
   ↓
5. Dunning Service: Create/update dunning record (Day 0)
   ↓
6. Dunning Service: State transitions (Days 1-7)
   ↓
7. Day 8: Dunning Service: Publish revocation event
   ↓
8. Entitlement Service: Revoke entitlements
```

### Database Schema

#### Products Table
```
PK: productId
Attributes:
- name
- description
- type (product/addon)
- entitlements (array)
- usageLimits (array)
- addons (array)
- addonConfigs (array)
- providers (map)
- isActive
```

#### Prices Table
```
PK: priceId
Attributes:
- productId
- billingType (one_time/recurring)
- interval (day/week/month/year)
- frequency (number)
- amount
- currency
- providers (map)
```

#### Entitlements Table
```
PK: USER#{userId}
SK: ENTITLEMENT#{entitlementKey}
Attributes:
- userId
- key
- role
- status
- grantedAt
- expiresAt
- usage (nested object)
  - limit
  - permanentLimit
  - used
  - resetAt
  - resetStrategy
```

#### Dunning Table
```
PK: USER#{userId}
Attributes:
- userId
- state (ACTION_REQUIRED/GRACE_PERIOD/RESTRICTED/SUSPENDED/OK)
- detectedAt (timestamp)
- lastEventType
- portalUrl
- expiresAt
```

### Event-Driven Architecture

The system uses AWS SNS for event publishing:

#### Billing Events Topic
- `subscription.created`
- `subscription.updated`
- `subscription.canceled`
- `subscription.expired`
- `payment.successful`
- `payment.failed`
- `payment.action_required`

#### Entitlement Events Topic
- `entitlement.created`
- `entitlement.updated`
- `entitlement.revoked`

### Idempotency

Both Stripe webhooks and billing events are idempotent:

- **Stripe Webhooks**: Tracked in `webhook-idempotency` table
- **Billing Events**: Tracked in `processed-events` table

This ensures events are only processed once, even if webhooks are retried.

---

## Event System

### Billing Events

Billing events are published by the Stripe Service when payment/subscription events occur.

#### Subscription Events

##### `subscription.created`
Published when a new subscription is created.

**Payload**:
```json
{
  "subscriptionId": "sub_123",
  "userId": "user_456",
  "productId": "prod_789",
  "priceId": "price_abc",
  "status": "active",
  "currentPeriodStart": "2024-01-15T00:00:00Z",
  "currentPeriodEnd": "2024-02-15T00:00:00Z",
  "cancelAtPeriodEnd": false,
  "addonProductIds": ["prod_addon_1", "prod_addon_2"]
}
```

##### `subscription.updated`
Published when a subscription is updated (product change, add-on added/removed, etc.).

**Payload**:
```json
{
  "subscriptionId": "sub_123",
  "userId": "user_456",
  "productId": "prod_789",
  "priceId": "price_abc",
  "status": "active",
  "currentPeriodStart": "2024-02-15T00:00:00Z",
  "currentPeriodEnd": "2024-03-15T00:00:00Z",
  "previousProductId": "prod_old",
  "addonProductIds": ["prod_addon_1"]
}
```

##### `subscription.canceled`
Published when a subscription is canceled (but still active until period end).

##### `subscription.expired`
Published when a subscription expires (period ended).

#### Payment Events

##### `payment.successful`
Published when a payment succeeds (one-time or subscription).

**Payload**:
```json
{
  "paymentIntentId": "pi_123",
  "userId": "user_456",
  "amount": 29.99,
  "currency": "USD",
  "priceId": "price_abc",
  "productId": "prod_789",
  "subscriptionId": "sub_123",
  "billingType": "one_time",
  "provider": "stripe"
}
```

##### `payment.failed`
Published when a payment fails.

**Payload**:
```json
{
  "paymentIntentId": "pi_123",
  "userId": "user_456",
  "amount": 29.99,
  "currency": "USD",
  "priceId": "price_abc",
  "productId": "prod_789",
  "provider": "stripe",
  "failureCode": "card_declined",
  "failureReason": "Your card was declined.",
  "portalUrl": "https://billing.stripe.com/...",
  "expiresAt": "2024-01-16T00:00:00Z"
}
```

##### `payment.action_required`
Published when payment requires user action (3D Secure, etc.).

### Entitlement Events

Entitlement events are published by the Entitlement Service when entitlements change.

#### `entitlement.created`
Published when a new entitlement is created.

**Payload**:
```json
{
  "userId": "user_456",
  "entitlementKey": "api_calls",
  "role": "LEARNER",
  "status": "active",
  "expiresAt": "2024-02-15T00:00:00Z",
  "usageLimit": {
    "limit": 5000,
    "used": 0
  },
  "productId": "prod_789",
  "reason": "subscription.created"
}
```

#### `entitlement.updated`
Published when an entitlement is updated.

#### `entitlement.revoked`
Published when an entitlement is revoked.

---

## API Reference

### Stripe Service

#### Create Payment Intent / Checkout Session

**Endpoint**: `POST /stripe/payment-intent`

**Request**:
```json
{
  "priceId": "price_123",
  "addonProductIds": ["prod_addon_1"],
  "successUrl": "https://app.example.com/success",
  "cancelUrl": "https://app.example.com/cancel"
}
```

**Response**:
```json
{
  "checkoutUrl": "https://checkout.stripe.com/...",
  "paymentIntentId": "pi_123",
  "customerId": "cus_123",
  "isUpdate": false
}
```

**Behavior**:
- For one-time payments: Creates checkout session with `mode: "payment"`
- For subscriptions: Creates checkout session with `mode: "subscription"`
- If user has existing subscription: Updates subscription instead of creating new one
- Supports add-ons for subscriptions only

#### Webhook Endpoint

**Endpoint**: `POST /stripe/webhook`

**Headers**:
- `stripe-signature`: Stripe webhook signature for verification

**Behavior**:
- Verifies webhook signature
- Processes webhook events
- Publishes billing events to SNS
- Implements idempotency

### Access Service

#### Get User Entitlements

**Endpoint**: `GET /access/entitlements`

**Headers**:
- `Authorization: Bearer <jwt_token>`

**Response**:
```json
{
  "userId": "user_456",
  "entitlements": {
    "premium_features": true,
    "api_calls": {
      "limit": 6000,
      "used": 2500
    },
    "storage_gb": {
      "limit": 150,
      "used": 75
    }
  }
}
```

#### Get Entitlement by Key

**Endpoint**: `GET /access/entitlements?entitlement_key=api_calls`

**Response**:
```json
{
  "userId": "user_456",
  "entitlements": {
    "api_calls": {
      "limit": 6000,
      "used": 2500
    }
  }
}
```

### Dunning Service

#### Get Billing Issue

**Endpoint**: `GET /dunning/billing-issue`

**Headers**:
- `Authorization: Bearer <jwt_token>`

**Response**:
```json
{
  "userId": "user_456",
  "hasIssue": true,
  "state": "GRACE_PERIOD",
  "daysSinceDetection": 2,
  "portalUrl": "https://billing.stripe.com/...",
  "expiresAt": "2024-01-18T00:00:00Z",
  "message": "Your payment failed. Please update your payment method to continue using the service."
}
```

**States**:
- `OK`: No billing issue
- `ACTION_REQUIRED`: Payment failed, action required (Day 0)
- `GRACE_PERIOD`: Warning phase (Days 1-3)
- `RESTRICTED`: Limited access (Days 4-7)
- `SUSPENDED`: Access revoked (Day 8+)

### Product Service

#### List Products

**Endpoint**: `GET /products`

**Query Parameters**:
- `type`: Filter by type (product/addon)
- `isActive`: Filter by active status
- `search`: Search by name prefix
- `page_number`: Page number (default: 1)
- `page_size`: Items per page (default: 20)

#### Get Product

**Endpoint**: `GET /products/{productId}`

#### Create Product

**Endpoint**: `POST /products`

**Request**:
```json
{
  "name": "Premium Plan",
  "description": "Monthly premium subscription",
  "type": "product",
  "entitlements": ["premium_features", "api_calls"],
  "usageLimits": [
    {
      "metric": "api_calls",
      "limit": 5000,
      "period": "billing_cycle"
    }
  ],
  "isActive": true
}
```

### Pricing Service

#### List Prices by Product

**Endpoint**: `GET /prices/product/{productId}`

#### Get Price

**Endpoint**: `GET /prices/{priceId}`

#### Create Price

**Endpoint**: `POST /prices`

**Request**:
```json
{
  "productId": "prod_123",
  "billingType": "recurring",
  "interval": "month",
  "frequency": 1,
  "amount": 29.99,
  "currency": "USD"
}
```

---

## Integration Guide

### Setting Up Products

#### Step 1: Create Product

```bash
POST /products
{
  "name": "Monthly API Plan",
  "type": "product",
  "entitlements": ["api_calls"],
  "usageLimits": [
    {
      "metric": "api_calls",
      "limit": 5000,
      "period": "billing_cycle"
    }
  ]
}
```

#### Step 2: Create Price

```bash
POST /prices
{
  "productId": "prod_123",
  "billingType": "recurring",
  "interval": "month",
  "frequency": 1,
  "amount": 29.99,
  "currency": "USD"
}
```

#### Step 3: Create Add-On (Optional)

```bash
POST /products
{
  "name": "API Boost",
  "type": "addon",
  "entitlements": ["api_calls"],
  "usageLimits": [
    {
      "metric": "api_calls",
      "limit": 5000,
      "period": "billing_cycle"
    }
  ]
}
```

### Processing Payments

#### One-Time Payment

1. User requests checkout with `priceId` (one-time price)
2. System creates checkout session with `mode: "payment"`
3. User completes payment
4. Webhook: `checkout.session.completed`
5. System publishes `payment.successful` with `billingType: "one_time"`
6. Entitlements created with permanent limits

#### Subscription

1. User requests checkout with `priceId` (recurring price)
2. System creates checkout session with `mode: "subscription"`
3. User completes payment
4. Webhook: `customer.subscription.created`
5. System publishes `subscription.created`
6. Entitlements created with expiration and regular limits

### Handling Usage

#### Check Entitlement

```typescript
// Check if user has access
const entitlements = await getEntitlements(userId);
if (entitlements.premium_features) {
  // User has access
}
```

#### Consume Usage

```typescript
// Check and consume usage
const entitlement = await getEntitlementByKey(userId, "api_calls");
if (entitlement.usage.canConsume(1)) {
  entitlement.usage.consume(1);
  await updateEntitlement(entitlement);
  // Proceed with API call
} else {
  // Usage exceeded
  throw new Error("API call limit exceeded");
}
```

### Monitoring Events

Subscribe to SNS topics to monitor:
- Billing events (subscriptions, payments)
- Entitlement events (created, updated, revoked)
- Dunning events (state transitions)

### Error Handling

#### Payment Failures

1. Monitor `payment.failed` events
2. Check dunning state via API
3. Display portal URL to user
4. Handle state transitions

#### Subscription Cancellations

1. Monitor `subscription.canceled` events
2. Entitlements remain active until `expiresAt`
3. On expiration, entitlements are revoked
4. Permanent limits remain

---

## Best Practices

### Product Design

1. **Use clear entitlement keys**: Use descriptive, consistent naming (e.g., `api_calls`, not `api` or `calls`)
2. **Set appropriate limits**: Balance user needs with business goals
3. **Choose reset strategies wisely**: Match reset strategy to billing cycle when possible
4. **Document entitlements**: Keep entitlement registry updated

### Pricing Strategy

1. **One-time for credits**: Use one-time payments for credits that should accumulate
2. **Subscriptions for access**: Use subscriptions for ongoing feature access
3. **Add-ons for flexibility**: Use add-ons to let users customize their plan
4. **Proration**: Leverage Stripe's automatic proration for add-ons

### Usage Management

1. **Check before consuming**: Always check `canConsume()` before allowing usage
2. **Handle exceeded limits**: Provide clear error messages when limits are exceeded
3. **Monitor usage**: Track usage patterns to optimize limits
4. **Reset handling**: Understand when resets occur and handle edge cases

### Payment Recovery

1. **Provide portal access**: Always show Customer Portal URL when payment fails
2. **Clear messaging**: Explain what happened and what user needs to do
3. **Grace period**: Respect the 8-day grace period before revoking access
4. **Permanent limits**: Remember that permanent limits survive payment failures

### Security

1. **Validate JWT tokens**: Always validate user identity via JWT
2. **Idempotency**: Ensure webhook processing is idempotent
3. **Signature verification**: Always verify Stripe webhook signatures
4. **Secrets management**: Store sensitive data (API keys, JWT secrets) in AWS Secrets Manager

---

## Troubleshooting

### Common Issues

#### Entitlements Not Created

**Symptoms**: User paid but doesn't have access

**Checks**:
1. Verify webhook was received (check Stripe dashboard)
2. Check SNS topic for billing events
3. Check Entitlement Service logs
4. Verify product has entitlements defined

#### Usage Not Resetting

**Symptoms**: Usage doesn't reset on renewal

**Checks**:
1. Verify reset strategy is `billing_cycle`
2. Check subscription renewal event was received
3. Verify `isRenewal` detection logic
4. Check entitlement `resetAt` date

#### Permanent Limits Not Working

**Symptoms**: One-time purchase limits not showing

**Checks**:
1. Verify `billingType: "one_time"` in payment event
2. Check `permanentLimit` field in entitlement
3. Verify `getEffectiveLimit()` includes permanent limit
4. Check entitlement wasn't revoked

#### Dunning Not Working

**Symptoms**: Payment fails but access not restricted

**Checks**:
1. Verify Dunning Service is subscribed to billing events
2. Check dunning state transitions
3. Verify Day 8+ revocation logic
4. Check entitlement service respects dunning state

---

## Conclusion

The Payment Service provides a comprehensive solution for managing products, pricing, payments, entitlements, and usage. By understanding the concepts and following best practices, you can build a robust billing system that handles:

- ✅ Multiple product types (base products, add-ons)
- ✅ Flexible pricing (one-time, subscriptions)
- ✅ Usage tracking and limits
- ✅ Automatic reset strategies
- ✅ Payment failure recovery
- ✅ Graceful access management

For specific implementation details, refer to the individual service README files and API documentation.

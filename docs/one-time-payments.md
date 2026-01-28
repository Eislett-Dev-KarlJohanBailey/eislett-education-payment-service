# One-Time Payments vs Subscriptions

This document explains the differences between one-time payments and subscriptions, and how entitlements are handled for each.

## Product Types

### One-Time Payments (`billingType: "one_time"`)

One-time payments are purchases that are charged once and provide lifetime access to the product. They are separate from subscriptions and have different entitlement behavior.

**Characteristics:**
- No expiration date - entitlements are granted for life
- Permanent limits - usage limits from one-time payments are added to `permanentLimit` and cannot be removed
- Independent from subscriptions - canceling a subscription does not affect one-time purchase entitlements
- Accumulative - buying the same product multiple times increases the permanent limit

### Subscriptions (`billingType: "recurring"`)

Subscriptions are recurring payments that provide time-limited access to products.

**Characteristics:**
- Expiration dates - entitlements expire when subscription ends
- Regular limits - usage limits reset based on reset strategy (billing cycle, daily, etc.)
- Can be canceled - canceling removes access when the subscription period ends
- Can be renewed - renewals reset usage based on reset strategy

## Entitlement Behavior

### One-Time Payments

When a one-time payment is successful:

1. **Entitlements Created:**
   - Entitlements are created **without expiration dates** (lifetime access)
   - If an entitlement already exists (from a previous subscription), the expiration date is **preserved** (not overwritten)
   - The entitlement status is set to `ACTIVE`

2. **Usage Limits:**
   - Limits are added to `permanentLimit` (not regular `limit`)
   - `permanentLimit` accumulates with each purchase of the same product
   - `permanentLimit` is **never removed**, even if subscriptions are canceled
   - The effective limit is: `limit + permanentLimit`

3. **Reset Strategy:**
   - No reset strategy is applied for one-time payments
   - Usage is never automatically reset
   - Users can consume from the permanent limit indefinitely

4. **Multiple Purchases:**
   - Buying the same product multiple times increases `permanentLimit`
   - Example: Buying "100 API calls" three times = `permanentLimit: 300`

### Subscriptions

When a subscription is created or updated:

1. **Entitlements Created:**
   - Entitlements are created with expiration dates (subscription period end)
   - If an entitlement already exists, the expiration date is updated
   - The entitlement status is set to `ACTIVE`

2. **Usage Limits:**
   - Limits are set in the regular `limit` field
   - Limits reset based on reset strategy (billing cycle, daily, weekly, etc.)
   - Limits are removed when subscription is canceled (but `permanentLimit` remains)

3. **Reset Strategy:**
   - Reset strategy is applied based on product configuration
   - Common strategies: `billing_cycle`, `day`, `week`, `month`, `year`, `lifetime`
   - Usage resets automatically based on the strategy

4. **Renewals:**
   - When a subscription renews, usage is reset if `resetStrategy.period === "billing_cycle"`
   - The `resetAt` date is updated to the new period end

## Combined Entitlements

When a user has both one-time purchases and subscriptions for the same entitlement:

- **Effective Limit:** `limit + permanentLimit`
- **Expiration:** Subscription expiration (if any) applies to the regular `limit`, but `permanentLimit` never expires
- **Usage:** Users can consume from both limits
- **Cancellation:** If subscription is canceled, only the regular `limit` is removed; `permanentLimit` remains

### Example Scenario

User has:
- One-time purchase: "100 API calls" → `permanentLimit: 100`
- Subscription: "500 API calls/month" → `limit: 500`

**Result:**
- Effective limit: `500 + 100 = 600` API calls
- Subscription expires in 30 days
- After expiration: Effective limit becomes `0 + 100 = 100` (permanent limit remains)

## Reset Strategy Behavior

### Always Increment Limits

Some reset strategies cause limits to **always increment** rather than overwrite:

- **`lifetime`**: Limits always increment (accumulate)
- **One-time payments**: Always increment to `permanentLimit`

### Overwrite Limits

Other reset strategies **overwrite** the limit:

- **`billing_cycle`**: Limit is set to product limit, resets on renewal
- **`day`**, **`week`**, **`month`**, **`year`**: Limit is set to product limit, resets periodically

## Product Configuration

### One-Time Payment Product

```json
{
  "productId": "prod-onetime-123",
  "name": "One-Time API Credits",
  "type": "product",
  "billingType": "one_time",
  "entitlements": ["api_calls"],
  "usageLimits": [
    {
      "metric": "api_calls",
      "limit": 1000,
      "period": "lifetime"
    }
  ]
}
```

### Subscription Product

```json
{
  "productId": "prod-subscription-123",
  "name": "Monthly API Plan",
  "type": "product",
  "billingType": "recurring",
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

## Stripe Integration

### One-Time Payments

- **Checkout Mode:** `mode: "payment"`
- **Webhook Event:** `checkout.session.completed` (for one-time payments)
- **Metadata:** Includes `billingType: "one_time"`

### Subscriptions

- **Checkout Mode:** `mode: "subscription"`
- **Webhook Events:** `customer.subscription.created`, `customer.subscription.updated`, `invoice.paid`
- **Metadata:** Includes `billingType: "recurring"`

## API Usage

### Creating One-Time Payment

```typescript
POST /stripe/payment-intent
{
  "priceId": "price-onetime-123",
  "successUrl": "https://app.example.com/success",
  "cancelUrl": "https://app.example.com/cancel"
}
```

The system automatically:
1. Detects `billingType: "one_time"` from the price
2. Creates checkout session with `mode: "payment"`
3. Publishes `payment.successful` event with `billingType: "one_time"`
4. Creates entitlements without expiration
5. Adds limits to `permanentLimit`

### Creating Subscription

```typescript
POST /stripe/payment-intent
{
  "priceId": "price-subscription-123",
  "successUrl": "https://app.example.com/success",
  "cancelUrl": "https://app.example.com/cancel"
}
```

The system automatically:
1. Detects `billingType: "recurring"` from the price
2. Creates checkout session with `mode: "subscription"`
3. Publishes `subscription.created` event
4. Creates entitlements with expiration
5. Sets limits in regular `limit` field

## Best Practices

1. **Use one-time payments for:**
   - Credits that should never expire
   - Lifetime access to features
   - One-off purchases that accumulate

2. **Use subscriptions for:**
   - Recurring access to features
   - Usage limits that reset periodically
   - Time-limited access

3. **Combining both:**
   - Users can have both one-time purchases and subscriptions
   - Permanent limits from one-time purchases persist even if subscription is canceled
   - Effective limit is the sum of both

4. **Reset Strategy Selection:**
   - Use `lifetime` for one-time purchases that should accumulate
   - Use `billing_cycle` for subscription limits that reset on renewal
   - Use `day`/`week`/`month` for limits that reset on a schedule

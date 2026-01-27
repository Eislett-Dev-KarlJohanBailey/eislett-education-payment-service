# Product Creation Guide

This guide explains how to create and configure products in the payment service, including entitlements, usage limits, add-ons, and reset strategies.

## Table of Contents

1. [Product Types](#product-types)
2. [Basic Product Structure](#basic-product-structure)
3. [Entitlements](#entitlements)
4. [Usage Limits](#usage-limits)
5. [Add-ons](#add-ons)
6. [Reset Strategies](#reset-strategies)
7. [Provider Integration](#provider-integration)
8. [Complete Examples](#complete-examples)

## Product Types

Products can be one of three types:

- **`ONE_OFF`**: One-time purchase products (e.g., course access, single purchase items)
- **`SUBSCRIPTION`**: Recurring subscription products (e.g., monthly/yearly plans)
- **`ADDON`**: Add-on products that can be attached to subscriptions (e.g., extra storage, premium features)

## Basic Product Structure

### Required Fields

```typescript
{
  productId: string;           // Unique identifier
  name: string;                 // Product name (min 3 characters)
  type: ProductType;            // ONE_OFF | SUBSCRIPTION | ADDON
  entitlements: EntitlementKey[]; // At least one entitlement required
  isActive: boolean;            // Whether product is available
}
```

### Optional Fields

```typescript
{
  description?: string;         // Product description
  usageLimits?: UsageLimit[];    // Usage limits for entitlements
  addons?: string[];            // Legacy: simple add-on product IDs
  addonConfigs?: AddonConfig[]; // Enhanced: add-on configurations
  providers?: Record<string, string>; // Payment provider mappings
}
```

## Entitlements

Entitlements define what access or features a product grants. Each product must have at least one entitlement.

### Available Entitlement Keys

```typescript
enum EntitlementKey {
  ACCESS_DASHBOARD = "access_dashboard",
  ACCESS_ANALYTICS = "access_analytics",
  CREATE_COURSE = "create_course",
  ASSIGN_HOMEWORK = "assign_homework",
  TAKE_QUIZ = "take_quiz",
  AI_TOKENS = "ai_tokens",
  QUIZ_ATTEMPTS = "quiz_attempts"
}
```

### Example

```typescript
{
  productId: "prod-premium",
  name: "Premium Plan",
  entitlements: [
    EntitlementKey.ACCESS_DASHBOARD,
    EntitlementKey.ACCESS_ANALYTICS,
    EntitlementKey.AI_TOKENS
  ]
}
```

## Usage Limits

Usage limits define how much of a resource can be consumed within a specific period. They sync automatically to user entitlements when a product is purchased.

### Usage Limit Structure

```typescript
interface UsageLimit {
  metric: string;        // e.g., "ai_tokens", "quiz_attempts", "api_calls"
  limit: number;         // Maximum allowed (e.g., 10000)
  period: UsagePeriod;   // "day" | "week" | "month" | "year" | "billing_cycle" | "lifetime"
  window?: UsageWindow;  // "calendar" | "rolling" | "billing" | "custom" (default: "calendar")
  startDate?: Date;      // For custom windows
}
```

### Supported Periods

- **`day`**: Daily limit (resets at midnight)
- **`week`**: Weekly limit (resets on Sunday by default)
- **`month`**: Monthly limit (resets on the 1st of each month)
- **`year`**: Yearly limit (resets on January 1st)
- **`billing_cycle`**: Resets when subscription renews
- **`lifetime`**: No reset (total lifetime limit)

### Usage Windows

- **`calendar`**: Fixed calendar periods (Jan 1-31, Feb 1-28, etc.)
- **`rolling`**: Rolling window (last 30 days from today)
- **`billing`**: Aligned with subscription billing date
- **`custom`**: Custom start date + period

### Examples

**Daily AI Token Limit:**
```typescript
{
  metric: "ai_tokens",
  limit: 10000,
  period: "day",
  window: "calendar"
}
```

**Monthly Quiz Attempts:**
```typescript
{
  metric: "quiz_attempts",
  limit: 50,
  period: "month",
  window: "calendar"
}
```

**Lifetime Course Access:**
```typescript
{
  metric: "course_access",
  limit: 100,
  period: "lifetime"
}
```

**Rolling Window API Calls:**
```typescript
{
  metric: "api_calls",
  limit: 5000,
  period: "month",
  window: "rolling"
}
```

## Add-ons

Add-ons are optional products that can be attached to subscription products. They support rich configuration including dependencies, conflicts, and pricing.

### AddonConfig Structure

```typescript
interface AddonConfig {
  productId: string;              // Add-on product ID
  required?: boolean;              // Must-have vs optional (default: false)
  minQuantity?: number;           // Minimum quantity (default: 1)
  maxQuantity?: number;           // Maximum quantity (default: unlimited)
  dependencies?: string[];        // Other add-on productIds required first
  conflicts?: string[];           // Add-on productIds that cannot coexist
  pricing?: {
    type: "fixed" | "per_unit" | "percentage";
    amount?: number;
    currency?: string;
    percentage?: number;          // For percentage-based pricing
  };
  metadata?: Record<string, any>; // Additional configuration
}
```

### Add-on Rules

1. Only `SUBSCRIPTION` products can have add-ons
2. `ADDON` products cannot have add-ons themselves
3. Dependencies must be added before dependent add-ons
4. Conflicting add-ons cannot be added together

### Examples

**Simple Optional Add-on:**
```typescript
{
  productId: "addon-extra-storage",
  required: false,
  minQuantity: 1,
  maxQuantity: 5,
  pricing: {
    type: "per_unit",
    amount: 500,  // $5.00 per unit
    currency: "USD"
  }
}
```

**Required Add-on with Dependencies:**
```typescript
{
  productId: "addon-premium-support",
  required: true,
  dependencies: ["addon-extra-storage"], // Requires extra storage first
  pricing: {
    type: "fixed",
    amount: 2000,  // $20.00
    currency: "USD"
  }
}
```

**Conflicting Add-ons:**
```typescript
// Add-on A
{
  productId: "addon-basic-theme",
  conflicts: ["addon-premium-theme"]
}

// Add-on B
{
  productId: "addon-premium-theme",
  conflicts: ["addon-basic-theme"]
}
```

## Reset Strategies

Reset strategies control when usage limits reset. They're automatically created from usage limit periods but can be customized.

### Reset Strategy Structure

```typescript
interface ResetStrategy {
  type: "manual" | "periodic" | "rolling";
  period?: "hour" | "day" | "week" | "month" | "quarter" | "year" | "billing_cycle" | "custom";
  dayOfMonth?: number;      // 1-31 for monthly resets
  dayOfWeek?: number;       // 0-6 (Sunday-Saturday) for weekly resets
  hour?: number;            // 0-23 for hourly/daily resets
  timezone?: string;        // IANA timezone (e.g., "America/New_York")
  customDays?: number;      // For custom period (e.g., every 7 days)
}
```

### Reset Types

- **`manual`**: Reset only when explicitly triggered (uses `resetAt` date)
- **`periodic`**: Automatic reset based on period (day, week, month, etc.)
- **`rolling`**: Rolling window (handled externally based on window type)

### Examples

**Daily Reset at Midnight:**
```typescript
{
  type: "periodic",
  period: "day",
  hour: 0
}
```

**Weekly Reset on Monday at 9 AM:**
```typescript
{
  type: "periodic",
  period: "week",
  dayOfWeek: 1,  // Monday
  hour: 9
}
```

**Monthly Reset on 15th at Start of Day:**
```typescript
{
  type: "periodic",
  period: "month",
  dayOfMonth: 15,
  hour: 0
}
```

**Custom 7-Day Rolling Window:**
```typescript
{
  type: "rolling",
  period: "custom",
  customDays: 7
}
```

## Provider Integration

Products can be linked to payment providers (Stripe, PayPal, etc.) for seamless integration.

### Provider Structure

```typescript
providers: {
  "stripe": "prod_stripe_123",
  "paypal": "PP-456",
  "square": "sq_prod_789"
}
```

### Example

```typescript
{
  productId: "prod-premium",
  providers: {
    stripe: "prod_abc123xyz",
    paypal: "PP-PREMIUM-001"
  }
}
```

## Complete Examples

### Example 1: Basic Subscription Product

```typescript
const premiumProduct = Product.create({
  productId: "prod-premium-monthly",
  name: "Premium Monthly Plan",
  description: "Full access to all features with monthly billing",
  type: ProductType.SUBSCRIPTION,
  entitlements: [
    EntitlementKey.ACCESS_DASHBOARD,
    EntitlementKey.ACCESS_ANALYTICS,
    EntitlementKey.AI_TOKENS,
    EntitlementKey.QUIZ_ATTEMPTS
  ],
  usageLimits: [
    {
      metric: "ai_tokens",
      limit: 50000,
      period: "month",
      window: "calendar"
    },
    {
      metric: "quiz_attempts",
      limit: 100,
      period: "month",
      window: "calendar"
    }
  ],
  isActive: true,
  providers: {
    stripe: "prod_premium_monthly",
    paypal: "PP-PREMIUM-MONTHLY"
  }
});
```

### Example 2: Subscription with Add-ons

```typescript
const enterpriseProduct = Product.create({
  productId: "prod-enterprise",
  name: "Enterprise Plan",
  type: ProductType.SUBSCRIPTION,
  entitlements: [
    EntitlementKey.ACCESS_DASHBOARD,
    EntitlementKey.ACCESS_ANALYTICS,
    EntitlementKey.CREATE_COURSE
  ],
  usageLimits: [
    {
      metric: "api_calls",
      limit: 100000,
      period: "month",
      window: "rolling"
    }
  ],
  addonConfigs: [
    {
      productId: "addon-extra-storage",
      required: false,
      minQuantity: 1,
      maxQuantity: 10,
      pricing: {
        type: "per_unit",
        amount: 1000,  // $10 per 100GB
        currency: "USD"
      }
    },
    {
      productId: "addon-premium-support",
      required: false,
      dependencies: ["addon-extra-storage"],
      pricing: {
        type: "fixed",
        amount: 5000,  // $50
        currency: "USD"
      }
    }
  ],
  isActive: true
});
```

### Example 3: One-Time Purchase Product

```typescript
const courseProduct = Product.create({
  productId: "prod-course-advanced-js",
  name: "Advanced JavaScript Course",
  description: "Complete advanced JavaScript course with lifetime access",
  type: ProductType.ONE_OFF,
  entitlements: [
    EntitlementKey.ACCESS_DASHBOARD,
    EntitlementKey.TAKE_QUIZ
  ],
  usageLimits: [
    {
      metric: "course_access",
      limit: 1,
      period: "lifetime"
    },
    {
      metric: "quiz_attempts",
      limit: 3,
      period: "lifetime"
    }
  ],
  isActive: true,
  providers: {
    stripe: "prod_course_js_advanced"
  }
});
```

### Example 4: Add-on Product

```typescript
const storageAddon = Product.create({
  productId: "addon-extra-storage",
  name: "Extra Storage (100GB)",
  description: "Additional 100GB of storage space",
  type: ProductType.ADDON,
  entitlements: [
    EntitlementKey.ACCESS_DASHBOARD  // Storage is typically infrastructure, not an entitlement
  ],
  isActive: true
});
```

## Syncing Product Limits to Entitlements

When a user purchases a product, you should sync the product's usage limits to their entitlements:

```typescript
import { SyncProductLimitsToEntitlementsUseCase } from "@libs/domain";

const syncUseCase = new SyncProductLimitsToEntitlementsUseCase(
  productRepository,
  entitlementRepository
);

await syncUseCase.execute({
  productId: "prod-premium-monthly",
  userId: "user-123"
});
```

This will:
1. Find the product and its usage limits
2. Find the user's entitlements
3. Update entitlement usage limits to match product limits
4. Set appropriate reset strategies based on periods
5. Calculate next reset dates

## Best Practices

1. **Naming Conventions**: Use clear, descriptive product IDs (e.g., `prod-premium-monthly`, `addon-extra-storage`)

2. **Entitlements**: Only include entitlements that the product actually grants. Don't include entitlements that come from add-ons.

3. **Usage Limits**: Define limits for all usage-based entitlements. Use appropriate periods based on billing cycles.

4. **Add-ons**: 
   - Keep add-ons simple and focused
   - Document dependencies clearly
   - Avoid circular dependencies
   - Test conflict scenarios

5. **Reset Strategies**: 
   - Use `calendar` windows for predictable billing
   - Use `rolling` windows for fair usage tracking
   - Align with billing cycles when possible

6. **Provider IDs**: Keep provider mappings up-to-date. Use consistent naming across providers.

7. **Testing**: Test product creation with various combinations of entitlements, limits, and add-ons before making products active.

## Common Patterns

### Pattern 1: Tiered Subscriptions

Create multiple subscription products with increasing limits:

```typescript
// Basic Plan
{
  productId: "prod-basic",
  usageLimits: [{ metric: "ai_tokens", limit: 10000, period: "month" }]
}

// Premium Plan
{
  productId: "prod-premium",
  usageLimits: [{ metric: "ai_tokens", limit: 50000, period: "month" }]
}

// Enterprise Plan
{
  productId: "prod-enterprise",
  usageLimits: [{ metric: "ai_tokens", limit: 200000, period: "month" }]
}
```

### Pattern 2: Base + Add-ons

Create a base subscription with optional add-ons:

```typescript
// Base subscription
{
  productId: "prod-base",
  entitlements: [EntitlementKey.ACCESS_DASHBOARD],
  addonConfigs: [
    { productId: "addon-ai-tokens", required: false },
    { productId: "addon-extra-storage", required: false }
  ]
}
```

### Pattern 3: Lifetime Access

Use `lifetime` period for one-time purchases:

```typescript
{
  productId: "prod-course-lifetime",
  type: ProductType.ONE_OFF,
  usageLimits: [
    { metric: "course_access", limit: 1, period: "lifetime" }
  ]
}
```

## Troubleshooting

### Issue: "Product must define at least one entitlement"
**Solution**: Ensure every product has at least one entitlement in the `entitlements` array.

### Issue: "Only subscription products can have add-ons"
**Solution**: Add-ons can only be added to `SUBSCRIPTION` type products, not `ONE_OFF` or `ADDON`.

### Issue: "Add-on products cannot have add-ons"
**Solution**: `ADDON` type products cannot themselves have add-ons. Only `SUBSCRIPTION` products can.

### Issue: Usage limits not syncing to entitlements
**Solution**: Call `SyncProductLimitsToEntitlementsUseCase` after product purchase or when limits change.

### Issue: Reset not happening automatically
**Solution**: Ensure reset strategy is set to `"periodic"` type, not `"manual"`. Check that `resetAt` date is being calculated correctly.

## API Reference

For detailed API documentation, see:
- [Product Service README](../services/product-service/README.md)
- [Entitlements Domain Documentation](../libs/domain/src/entitlements/README.md)

# Trial Service - Business Guide

## Overview

The Trial Service enables users to try products for free for a limited time without requiring payment information. This guide explains how trials work from a business perspective and how to use them effectively.

## What is a Trial?

A **trial** is a time-limited, free access period to a product. During a trial:

- ✅ User gets **full access** to all product features
- ✅ User gets **all entitlements** from the product
- ✅ User gets **all usage limits** (if applicable)
- ✅ **No payment required** - completely free
- ⏰ **Time-limited** - expires after configured duration (default: 3 hours)
- 🔒 **One-time only** - each user can only trial each product once

## Business Value

### Why Offer Trials?

1. **Reduce Friction**: Users can try before buying without entering payment info
2. **Increase Conversions**: Users who try are more likely to purchase
3. **Build Trust**: Free trials demonstrate confidence in product value
4. **User Education**: Users learn how to use the product before purchasing
5. **Competitive Advantage**: Free trials differentiate from competitors

### When to Use Trials

**Best For**:
- Premium subscription products
- Products with clear, immediate value
- Products that can be evaluated in a short time
- Products where users need to "see it to believe it"

**Not Ideal For**:
- One-time purchases (users should just buy)
- Add-ons (trials don't make sense for add-ons)
- Products requiring extensive setup
- Products where value isn't immediately apparent

## How Trials Work

### Trial Lifecycle

```
1. User Requests Trial
   ↓
2. System Validates (product exists, user hasn't trialed before)
   ↓
3. Trial Created (3 hours from now)
   ↓
4. Entitlements Granted (full product access)
   ↓
5. User Uses Product (full features, usage limits)
   ↓
6. Trial Expires (after 3 hours)
   ↓
7. Access Revoked (user must purchase to continue)
```

### Trial Duration

**Default**: 3 hours

**Why 3 Hours?**
- Long enough to evaluate most features
- Short enough to create urgency
- Prevents abuse (can't use indefinitely)
- Good balance for conversion

**Custom Durations**:
- Can be configured per trial request
- Common options: 1 hour, 3 hours, 24 hours, 7 days
- Choose based on product complexity

### One-Time Restriction

**Rule**: Each user can only trial each product **once**

**Why?**
- Prevents abuse (users can't get infinite free access)
- Encourages conversion (users must purchase after trial)
- Fair to paying customers

**What Happens if User Tries Again?**
- System returns error: "User already has a trial for this product"
- User must purchase the product to get access

## Product Configuration

### Which Products Can Have Trials?

**Can Have Trials**:
- ✅ Base products (`type: "product"`)
- ✅ Active products (`isActive: true`)
- ✅ Products with entitlements

**Cannot Have Trials**:
- ❌ Add-on products (`type: "addon"`)
- ❌ Inactive products
- ❌ Products without entitlements

### Product Requirements

For a product to support trials:

1. **Must be Active**: `isActive: true`
2. **Must have Entitlements**: At least one entitlement key
3. **Must be Base Product**: Not an add-on

**Example Product Configuration**:
```json
{
  "productId": "prod-premium-plan",
  "name": "Premium Plan",
  "type": "product",
  "isActive": true,
  "entitlements": ["premium_features", "api_calls"],
  "usageLimits": [
    {
      "metric": "api_calls",
      "limit": 5000,
      "period": "billing_cycle"
    }
  ]
}
```

## User Experience

### Starting a Trial

**User Journey**:
1. User browses products
2. User sees "Start Free Trial" button
3. User clicks button (no payment info required)
4. System creates trial immediately
5. User gets instant access to all features

**API Call**:
```bash
POST /trial
{
  "productId": "prod-premium-plan"
}
```

**Response**:
```json
{
  "trialId": "user-123-prod-premium-plan",
  "expiresAt": "2024-01-15T15:30:00.000Z"
}
```

### During Trial

**What User Gets**:
- Full access to all product entitlements
- All usage limits (e.g., 5000 API calls)
- All features enabled
- Same experience as paid users

**What User Sees**:
- Trial badge/indicator in UI
- Countdown timer showing time remaining
- "Upgrade to Paid" button
- Reminders before expiration

### After Trial Expires

**What Happens**:
- Entitlements become inactive (expired)
- User loses access to trial features
- User must purchase to regain access

**User Options**:
1. **Purchase Product**: Buy subscription to continue
2. **Do Nothing**: Lose access (can't trial again)

## Conversion Strategy

### Best Practices

#### 1. **Remind Before Expiration**

Send reminders at key intervals:
- **2 hours remaining**: "Your trial expires in 2 hours"
- **1 hour remaining**: "Last chance! Trial expires in 1 hour"
- **30 minutes remaining**: "Trial expiring soon - upgrade now"
- **At expiration**: "Trial expired - upgrade to continue"

#### 2. **Show Value During Trial**

- Highlight premium features user is accessing
- Show usage statistics (e.g., "You've used 2,500 of 5,000 API calls")
- Display what user will lose when trial expires

#### 3. **Make Conversion Easy**

- Provide direct "Upgrade" button in UI
- Link to purchase page with product pre-selected
- Offer special trial-to-paid conversion incentives (optional)

#### 4. **Track Metrics**

Monitor:
- **Trial Start Rate**: How many trials per day/week
- **Conversion Rate**: % of trials that convert to paid
- **Time to Convert**: How long before users convert
- **Popular Products**: Which products get most trials

## Trial vs. Other Access Types

### Trial vs. Subscription

| Feature | Trial | Subscription |
|---------|-------|--------------|
| **Payment Required** | No | Yes |
| **Duration** | 3 hours (default) | Ongoing (renews) |
| **Can Repeat** | No (once per product) | Yes (renews automatically) |
| **Expiration** | Automatic | Manual cancellation |
| **Usage Limits** | Yes (expire with trial) | Yes (reset on renewal) |

### Trial vs. One-Time Purchase

| Feature | Trial | One-Time Purchase |
|---------|-------|-------------------|
| **Payment Required** | No | Yes |
| **Duration** | 3 hours | Lifetime |
| **Expiration** | Yes (automatic) | No (permanent) |
| **Usage Limits** | Yes (expire) | Yes (permanent) |

## Use Cases

### Use Case 1: Premium Feature Discovery

**Scenario**: User wants to try premium analytics before buying

**Flow**:
1. User sees "Premium Analytics" feature
2. User clicks "Start 3-Hour Trial"
3. User gets full analytics access
4. User evaluates features
5. User purchases if satisfied

**Outcome**: User converts to paid or trial expires

### Use Case 2: Enterprise Plan Evaluation

**Scenario**: Business user wants to evaluate enterprise features

**Flow**:
1. User starts trial for "Enterprise Plan"
2. User gets access to all enterprise features
3. User tests with their team/data
4. User makes purchase decision

**Outcome**: Higher conversion rate for enterprise plans

### Use Case 3: API Usage Evaluation

**Scenario**: Developer wants to test API limits before subscribing

**Flow**:
1. Developer starts trial for "API Pro Plan"
2. Developer gets 5000 API calls for 3 hours
3. Developer tests API integration
4. Developer purchases if API meets needs

**Outcome**: Developer converts or finds product doesn't fit

## Pricing Strategy

### Trial as Lead Generation

**Goal**: Convert trial users to paid customers

**Strategy**:
1. Offer attractive trial (good features, reasonable duration)
2. Show value during trial
3. Remind before expiration
4. Make conversion easy

### Trial Duration Selection

**3 Hours** (Recommended):
- ✅ Good for most products
- ✅ Creates urgency
- ✅ Prevents abuse
- ✅ Enough time to evaluate

**24 Hours**:
- ✅ Good for complex products
- ✅ Allows thorough evaluation
- ⚠️ Less urgency
- ⚠️ Higher risk of abuse

**7 Days**:
- ✅ Good for enterprise products
- ✅ Allows team evaluation
- ⚠️ Very long (less urgency)
- ⚠️ Higher infrastructure cost

## Metrics & Analytics

### Key Metrics

1. **Trial Start Rate**
   - How many trials started per day/week
   - Which products get most trials
   - Peak trial times

2. **Conversion Rate**
   - % of trials that convert to paid
   - Time to conversion
   - Products with best conversion

3. **Trial Expiration Rate**
   - % of trials that expire without conversion
   - Reasons for non-conversion
   - Opportunities for improvement

4. **Revenue from Trials**
   - Total revenue from trial conversions
   - Average revenue per trial user
   - ROI of trial program

### Conversion Benchmarks

**Industry Averages**:
- Trial-to-paid conversion: 10-25%
- Time to convert: 1-2 hours into trial
- Best conversion time: Last hour of trial

**Optimization Targets**:
- Aim for 20%+ conversion rate
- Reduce time to convert
- Increase trial start rate

## Best Practices

### Product Selection

**Offer Trials For**:
- Premium subscription products
- Products with clear value proposition
- Products that can be evaluated quickly
- High-value products (justify trial cost)

**Don't Offer Trials For**:
- One-time purchases (just buy it)
- Add-ons (trials don't make sense)
- Free products (no need for trial)
- Products requiring extensive setup

### Trial Duration

**Recommendation**: Start with 3 hours for most products

**Adjust Based On**:
- Product complexity (simple = shorter, complex = longer)
- User feedback (if users say "not enough time", increase)
- Conversion data (if low conversion, try longer duration)

### User Communication

**During Trial**:
- Show trial status clearly
- Display time remaining
- Highlight premium features being used
- Show what will be lost at expiration

**Before Expiration**:
- Send reminders (2h, 1h, 30min before)
- Show value delivered during trial
- Make upgrade easy (one-click)

**After Expiration**:
- Clear message that trial expired
- Easy path to purchase
- Option to start different product trial

## Limitations & Considerations

### Technical Limitations

1. **One Trial Per Product**: Users can't trial the same product twice
2. **No Payment Info**: Trials don't require payment, so no automatic conversion
3. **Time-Limited**: Trials expire automatically (no manual extension)
4. **No Partial Trials**: Users get full product access (can't trial specific features)

### Business Considerations

1. **Infrastructure Cost**: Trials use resources (entitlements, usage limits)
2. **Support Cost**: Trial users may need support
3. **Conversion Risk**: Not all trials convert to paid
4. **Abuse Prevention**: One-time restriction prevents abuse

### Mitigation Strategies

1. **Monitor Usage**: Track trial usage patterns
2. **Set Limits**: Use reasonable trial durations
3. **Track Conversions**: Optimize based on data
4. **User Education**: Help users understand product value

## Integration with Other Services

### Product Service

- Provides product information
- Validates product exists and is active
- Provides entitlements and usage limits

### Access Service

- Stores trial entitlements
- Manages entitlement expiration
- Provides entitlement lookup API

### Stripe Service

- Handles actual purchases
- Users purchase after trial expires
- Converts trial users to paid customers

## Example Scenarios

### Scenario 1: Successful Conversion

```
Day 1, 10:00 AM: User starts 3-hour trial for "Premium Plan"
Day 1, 10:00 AM - 1:00 PM: User uses premium features
Day 1, 12:30 PM: User receives "30 minutes remaining" reminder
Day 1, 12:45 PM: User purchases subscription
Result: Trial converted to paid subscription ✅
```

### Scenario 2: Trial Expiration

```
Day 1, 10:00 AM: User starts 3-hour trial for "API Pro Plan"
Day 1, 10:00 AM - 1:00 PM: User tests API (uses 2000 of 5000 calls)
Day 1, 1:00 PM: Trial expires
Day 1, 1:01 PM: User tries to use API → Access denied
Result: User must purchase to continue ❌
```

### Scenario 3: Second Trial Attempt

```
Day 1: User starts trial for "Premium Plan" (succeeds)
Day 1: Trial expires
Day 2: User tries to start trial again for "Premium Plan"
Result: Error - "User already has a trial for this product" ❌
User must purchase to get access again
```

## Conclusion

The Trial Service provides a powerful way to let users try products before purchasing. By offering free, time-limited access, you can:

- ✅ Reduce purchase friction
- ✅ Increase conversion rates
- ✅ Build user trust
- ✅ Educate users about product value

**Key Success Factors**:
1. Choose the right products for trials
2. Set appropriate trial durations
3. Communicate clearly with users
4. Make conversion easy
5. Track and optimize based on metrics

For technical implementation details, see the [Trial Service README](../services/trial-service/README.md).

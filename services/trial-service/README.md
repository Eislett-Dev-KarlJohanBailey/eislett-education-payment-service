# Trial Service

A serverless Lambda function service for managing free product trials. This service allows users to start time-limited trials of products without requiring payment information.

## Overview

The Trial Service provides a simple API endpoint that enables users to start free trials of products. Each user can only trial a product once, and trials are tracked in DynamoDB to prevent abuse.

### Features

- **One-Time Trial**: Each user can only trial a product once
- **No Payment Required**: Trials are completely free with no payment information needed
- **Time-Limited**: Default 3-hour trial duration (configurable)
- **Full Product Access**: Users get full access to all product entitlements and usage limits during the trial
- **Automatic Expiration**: Trials automatically expire after the configured duration
- **Trial Status Check**: Check if a user has already trialed a product before attempting to start a new trial

## Architecture

The service follows a clean architecture pattern:

```
src/
├── app/                    # Application layer
│   ├── controllers/       # API Gateway request handlers
│   └── usecases/          # Business logic
├── handler/                # Lambda handlers
│   └── api-gateway/       # API Gateway handler
└── bootstrap.ts           # Dependency injection
```

## Environment Variables

### Required

- `TRIALS_TABLE` - Name of the DynamoDB table storing trial records
- `PRODUCTS_TABLE` - Name of the DynamoDB table storing products (from product-service)
- `ENTITLEMENTS_TABLE` - Name of the DynamoDB table storing entitlements (from access-service)
- `JWT_ACCESS_TOKEN_SECRET` - JWT secret for authentication (from AWS Secrets Manager)

## API Endpoints

### Check Trial Status

**Endpoint**: `GET /trial?productId={productId}`

**Headers**:
- `Authorization: Bearer <jwt_token>` (required)

**Query Parameters**:
- `productId` (required) - The product ID to check trial status for

**Response** (200 OK):
```json
{
  "hasTrialed": true,
  "trial": {
    "startedAt": "2024-01-15T12:30:00.000Z",
    "expiresAt": "2024-01-15T15:30:00.000Z",
    "status": "active",
    "isActive": true
  }
}
```

If user has not trialed the product:
```json
{
  "hasTrialed": false
}
```

**Error Responses**:

- `400 Bad Request`: Missing productId
- `401 Unauthorized`: Missing or invalid JWT token

**Example**:
```bash
curl -X GET "https://api.example.com/trial?productId=prod-premium-plan" \
  -H "Authorization: Bearer <jwt_token>"
```

### Start Trial

**Endpoint**: `POST /trial`

**Headers**:
- `Authorization: Bearer <jwt_token>` (required)

**Request Body**:
```json
{
  "productId": "prod-premium-plan",
  "trialDurationHours": 3
}
```

**Request Parameters**:
- `productId` (required) - The product ID to start a trial for
- `trialDurationHours` (optional) - Trial duration in hours (defaults to 3)

**Response** (200 OK):
```json
{
  "trialId": "user-123-prod-premium-plan",
  "expiresAt": "2024-01-15T15:30:00.000Z"
}
```

**Error Responses**:

- `400 Bad Request`: Invalid request body or missing productId
- `401 Unauthorized`: Missing or invalid JWT token
- `404 Not Found`: Product not found or not active
- `409 Conflict`: User already has a trial for this product

**Example**:
```bash
curl -X POST https://api.example.com/trial \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "prod-premium-plan",
    "trialDurationHours": 3
  }'
```

## How It Works

### Trial Flow

1. **User Requests Trial**: User calls `POST /trial` with a product ID
2. **Validation**: System checks:
   - User is authenticated (JWT token)
   - Product exists and is active
   - User hasn't already trialed this product
3. **Trial Creation**: System creates:
   - Trial record in DynamoDB (tracks that user has trialed this product)
   - Entitlements for the product (with expiration = trial end time)
   - Usage limits (if product has usage-based entitlements)
4. **Response**: Returns trial ID and expiration time

### Trial Expiration

- Trials automatically expire after the configured duration (default: 3 hours)
- When a trial expires:
  - Entitlements remain but become inactive (expired)
  - User loses access to trial features
  - User can purchase the product to regain access

### One-Time Restriction

- Each user can only trial a product **once**
- This is enforced by checking the `trials` DynamoDB table
- If a user tries to start a trial for a product they've already trialed, they receive a `409 Conflict` error

### Trial Record Structure

Trial records are stored in DynamoDB with the following structure:

```
PK: USER#{userId}
SK: PRODUCT#{productId}
Attributes:
- userId: string
- productId: string
- startedAt: ISO 8601 timestamp
- expiresAt: ISO 8601 timestamp
- status: "active" | "expired" | "converted"
```

## Integration with Entitlements

When a trial is started:

1. **Entitlements Created**: All entitlements from the product are created for the user
2. **Expiration Set**: Entitlements expire at the trial end time
3. **Usage Limits**: If the product has usage limits, they are synced to entitlements
4. **Reset Strategy**: Usage limits follow the product's reset strategy (but expire with the trial)

**Example**:
- Product: "Premium Plan" with `api_calls` entitlement (limit: 5000, period: billing_cycle)
- Trial: 3 hours
- Result: User gets `api_calls` with limit 5000, expires in 3 hours

## Business Use Cases

### Use Case 1: Product Discovery

**Scenario**: User wants to try a premium feature before purchasing

**Flow**:
1. User browses products
2. User checks trial status (GET /trial) to see if they've already trialed
3. If not trialed, user clicks "Start Free Trial" on a product
4. System creates 3-hour trial
5. User can use all product features during trial
6. After 3 hours, user must purchase to continue

### Use Case 2: Feature Evaluation

**Scenario**: User wants to evaluate if a product meets their needs

**Flow**:
1. User starts trial for "Enterprise Plan"
2. User gets full access for 3 hours
3. User can test all features, usage limits, etc.
4. If satisfied, user purchases before trial expires
5. If not, trial expires and user loses access

### Use Case 3: Conversion Funnel

**Scenario**: Use trials to convert free users to paid

**Flow**:
1. Free user discovers premium feature
2. User starts trial (no payment required)
3. User experiences premium value
4. System can send conversion prompts before trial expires
5. User converts to paid subscription

## Best Practices

### Trial Duration

- **3 hours**: Good for quick feature demos
- **24 hours**: Good for comprehensive evaluation
- **7 days**: Good for complex products requiring extended evaluation

**Recommendation**: Start with 3 hours for most products. Adjust based on product complexity and user feedback.

### Product Selection

Not all products should have trials:

**Good for Trials**:
- ✅ Premium features
- ✅ Subscription products
- ✅ Products with clear value proposition
- ✅ Products that can be evaluated quickly

**Not Good for Trials**:
- ❌ One-time purchases (users should just buy)
- ❌ Add-ons (trials don't make sense)
- ❌ Products requiring setup time > trial duration

### Conversion Strategy

1. **Remind Before Expiration**: Send reminders 1 hour before trial expires
2. **Show Value**: Highlight what user will lose when trial expires
3. **Easy Conversion**: Provide direct link to purchase
4. **Track Conversions**: Monitor trial-to-paid conversion rates

## Limitations

- **One Trial Per Product**: Users can only trial each product once
- **No Payment Info**: Trials don't require payment, so no automatic conversion
- **Time-Limited**: Trials expire automatically (no manual extension)
- **No Partial Trials**: Users get full product access (can't trial specific features)

## Related Services

- **Product Service**: Provides product information
- **Access Service**: Manages entitlements (trial entitlements are stored here)
- **Stripe Service**: Handles actual purchases (users purchase after trial)

## Deployment

The service is deployed using Terraform with the following resources:

- **DynamoDB Table**: `{project-name}-{environment}-trials`
- **Lambda Function**: `trial-service`
- **API Gateway**: Integrated with existing API Gateway
- **IAM Role**: Permissions for DynamoDB (trials, products, entitlements) and Secrets Manager

## Testing

### Local Testing

```bash
# Start trial
curl -X POST http://localhost:3000/trial \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "prod-premium-plan"
  }'
```

### Testing Trial Restriction

```bash
# Check if user has trialed (should return hasTrialed: false)
curl -X GET "http://localhost:3000/trial?productId=prod-premium-plan" \
  -H "Authorization: Bearer <jwt_token>"

# First trial (should succeed)
curl -X POST http://localhost:3000/trial \
  -H "Authorization: Bearer <jwt_token>" \
  -d '{"productId": "prod-premium-plan"}'

# Check trial status (should return hasTrialed: true with trial details)
curl -X GET "http://localhost:3000/trial?productId=prod-premium-plan" \
  -H "Authorization: Bearer <jwt_token>"

# Second trial (should fail with 409)
curl -X POST http://localhost:3000/trial \
  -H "Authorization: Bearer <jwt_token>" \
  -d '{"productId": "prod-premium-plan"}'
```

## Monitoring

Key metrics to monitor:

- **Trial Start Rate**: How many trials are started per day
- **Trial Conversion Rate**: Percentage of trials that convert to paid
- **Trial Expiration Rate**: How many trials expire without conversion
- **Popular Products**: Which products get the most trials

## Troubleshooting

### Common Issues

**Issue**: "User already has a trial for this product"
- **Cause**: User previously started a trial for this product
- **Solution**: User must purchase the product to get access again

**Issue**: "Product not found"
- **Cause**: Product ID doesn't exist or product is inactive
- **Solution**: Verify product exists and is active

**Issue**: "Trial expired but entitlements still active"
- **Cause**: Entitlement expiration check happens on access (lazy evaluation)
- **Solution**: This is expected - entitlements will be inactive when user tries to access them

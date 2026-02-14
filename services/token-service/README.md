# Token Service

A serverless Lambda function service that handles token-based purchases. Users can purchase products using their token entitlement balance instead of traditional payment methods.

## Overview

The Token Service provides:
- **Token-based Purchases**: Allows users to purchase products using their token entitlement balance
- **Balance Validation**: Checks user's token balance before processing purchase
- **Event Publishing**: Publishes billing events to SNS for entitlement processing
- **JWT Authentication**: All endpoints require authentication

## Features

- **Token Balance Check**: Validates user has sufficient tokens before purchase
- **Price Validation**: Ensures price currency is "token"
- **Usage Decrement**: Decrements user's token entitlement balance
- **Event Publishing**: Publishes payment.successful events to SNS
- **Idempotency**: Generates unique payment intent IDs for tracking

## Architecture

```
User Request (JWT + priceId) → API Gateway → Lambda
                          ↓
              Charge Token UseCase
                          ↓
        ┌─────────────────┴─────────────────┐
        ↓                                   ↓
  Validate Price Currency      Check Token Balance
        ↓                                   ↓
  Get Product                  Decrement Tokens
        ↓                                   ↓
  Publish Event                Return Result
```

## Environment Variables

### Required

- `ENTITLEMENTS_TABLE` - DynamoDB table name (from access-service)
- `PRODUCTS_TABLE` - DynamoDB table name (from product-service)
- `PRICES_TABLE` - DynamoDB table name (from pricing-service)
- `BILLING_EVENTS_TOPIC_ARN` - SNS topic ARN (from entitlement-service)
- `JWT_ACCESS_TOKEN_SECRET` - JWT secret for authentication (from Secrets Manager)

## API Endpoints

### POST /token/charge

Charges tokens from a user's token entitlement to purchase a product.

**Authentication**: Required (JWT Bearer token)

**Request Body**:
```json
{
  "priceId": "price_123"
}
```

**Response (200)**:
```json
{
  "success": true,
  "paymentIntentId": "token_1234567890_abc123",
  "amount": 50,
  "remainingTokens": 450
}
```

**Errors**:
- `400` - Domain error (insufficient tokens, invalid currency, etc.)
- `401` - Unauthorized (missing or invalid JWT)
- `404` - Not found (price or entitlement not found)

**Example**:
```bash
curl -X POST https://api.example.com/token/charge \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{"priceId": "price_123"}'
```

## How It Works

1. **User Request**: User provides `priceId` and JWT token
2. **Price Validation**: Service validates price exists and currency is "token"
3. **Product Lookup**: Retrieves product associated with the price
4. **Token Check**: Retrieves user's "token" entitlement and checks balance
5. **Balance Validation**: Ensures user has sufficient tokens
6. **Token Decrement**: Increases `used` amount in entitlement (decreasing available balance)
7. **Event Publishing**: Publishes `payment.successful` event to SNS
8. **Response**: Returns success status, payment intent ID, amount charged, and remaining balance

## Token Entitlement

Users must have a "token" entitlement with usage tracking enabled. The entitlement should have:
- A `limit` (total tokens available)
- A `used` counter (tokens consumed)
- Available tokens = `limit - used`

When a purchase is made, the `used` counter is increased by the price amount, effectively decreasing available tokens.

## Billing Events

The service publishes `payment.successful` events to the billing events SNS topic. These events are processed by:
- **Entitlement Service**: Creates/updates product entitlements for the user
- **Transaction Service**: Records the transaction
- **Dunning Service**: Tracks payment status (if applicable)

## Dependencies

- **Product Service**: Provides product information
- **Pricing Service**: Provides price information
- **Access Service**: Provides entitlement information
- **Entitlement Service**: Provides billing events SNS topic

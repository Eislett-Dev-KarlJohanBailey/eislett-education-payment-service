# Token Service

A serverless Lambda function service that handles token-based purchases. Users can purchase products using their token entitlement balance instead of traditional payment methods.

## Overview

The Token Service provides:
- **Token-based Purchases**: Allows users to purchase products using their token entitlement balance
- **Balance Validation**: Checks user's token balance before processing purchase
- **Immediate Entitlement Grant**: Applies product entitlements directly in the request (no SQS) for faster access
- **JWT Authentication**: All endpoints require authentication

## Features

- **Token Balance Check**: Validates user has sufficient tokens before purchase
- **Price Validation**: Ensures price currency is "token"
- **Usage Decrement**: Decrements user's token entitlement balance
- **Inline Entitlement Application**: Creates/updates product entitlements for the user in the same request (same logic as entitlement-service for one-time payments)
- **Payment Intent ID**: Generates unique payment intent IDs for reference

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
  Apply Product Entitlements   Return Result
  (inline, no SQS)
```

## Environment Variables

### Required

- `ENTITLEMENTS_TABLE` - DynamoDB table name (from access-service)
- `PRODUCTS_TABLE` - DynamoDB table name (from product-service)
- `PRICES_TABLE` - DynamoDB table name (from pricing-service)
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
7. **Apply Entitlements**: Creates/updates the product's entitlements for the user inline (one-time payment logic: create or activate entitlements, sync product usage limits)
8. **Response**: Returns success status, payment intent ID, amount charged, and remaining balance

## Token Entitlement

Users must have a "token" entitlement with usage tracking enabled. The entitlement should have:
- A `limit` (total tokens available)
- A `used` counter (tokens consumed)
- Available tokens = `limit - used`

When a purchase is made, the `used` counter is increased by the price amount, effectively decreasing available tokens.

## Entitlement Application

The token charge endpoint applies product entitlements directly in the same request (no SQS or SNS). It uses the same logic as the entitlement-service for one-time payments: create or activate entitlements for each product entitlement key, then sync the product's usage limits to the user's entitlements (e.g. permanent limit for one-time purchases). This gives the user immediate access without waiting for async event processing.

## Dependencies

- **Product Service**: Provides product information
- **Pricing Service**: Provides price information
- **Access Service**: Provides entitlement information (DynamoDB entitlements table)

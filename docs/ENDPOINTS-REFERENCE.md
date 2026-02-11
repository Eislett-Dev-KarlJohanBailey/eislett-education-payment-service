# Payment Service — Complete Endpoints Reference

This document describes **every HTTP endpoint** in the eislett-education-payment-service: request bodies (all POST/PUT), query parameters (all GETs), path parameters, and response shapes. Use it as the single source of truth for integrating with products, pricing, access (entitlements), payment intents, dunning, transactions, trials, and auth.

**Base URL**: All endpoints are relative to your API Gateway base URL (e.g. `https://api.example.com` or `https://api.example.com/v1`). Paths may be mounted with or without a `/v1` prefix; the services normalize `/v1` internally.

**Authentication**: Unless noted otherwise, send a JWT in the header:
```http
Authorization: Bearer <jwt-token>
```

---

## Table of Contents

1. [Product Service](#1-product-service)
2. [Pricing Service](#2-pricing-service)
3. [Access Service (Entitlements)](#3-access-service-entitlements)
4. [Stripe Service (Payment Intent, Methods, Portal)](#4-stripe-service-payment-intent-methods-portal)
5. [Trial Service](#5-trial-service)
6. [Transaction Service](#6-transaction-service)
7. [Dunning Service](#7-dunning-service)
8. [Auth Service](#8-auth-service)
9. [Entitlement & Usage Event Services (No HTTP API)](#9-entitlement--usage-event-services-no-http-api)

---

## 1. Product Service

**Base path**: `/products`

All product endpoints require authentication.

---

### POST /products — Create product

**Method**: `POST`  
**Path**: `/products`  
**Body**: Required (JSON).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Product name (min 3 characters). |
| `description` | string | No | Product description. |
| `type` | string | Yes | One of: `"one_off"`, `"subscription"`, `"addon"`. |
| `entitlements` | string[] | Yes | At least one entitlement key (e.g. `"AI_TOKENS"`, `"access_dashboard"`). |
| `usageLimits` | array | No | Usage limits for usage-based entitlements. |
| `addons` | string[] | No | Legacy: list of add-on product IDs (subscriptions only). |
| `addonConfigs` | array | No | Enhanced add-on config (see AddonConfig below). |
| `providers` | object | No | Provider name → provider ID, e.g. `{ "stripe": "prod_xxx" }`. |

**usageLimits** item shape:

| Field | Type | Description |
|-------|------|-------------|
| `metric` | string | e.g. `"api_calls"`, `"ai_tokens"`, `"quiz_attempts"`. |
| `limit` | number | Limit value. |
| `period` | string | One of: `"day"`, `"week"`, `"month"`, `"year"`, `"billing_cycle"`, `"lifetime"`. |
| `window` | string | Optional: `"calendar"`, `"rolling"`, `"billing"`, `"custom"`. |
| `startDate` | string (ISO date) | Optional; for custom windows. |

**addonConfigs** item shape (AddonConfig):

| Field | Type | Description |
|-------|------|-------------|
| `productId` | string | Add-on product ID. |
| `required` | boolean | Optional; must-have vs optional. |
| `minQuantity` | number | Optional. |
| `maxQuantity` | number | Optional. |
| `dependencies` | string[] | Other add-on productIds that must be included. |
| `conflicts` | string[] | Add-on productIds that cannot coexist. |
| `pricing` | object | Optional: `{ type, amount?, currency?, percentage? }`. |
| `metadata` | object | Optional. |

**Example request body**:

```json
{
  "name": "Premium Plan",
  "description": "Monthly premium subscription",
  "type": "subscription",
  "entitlements": ["AI_TOKENS", "access_dashboard"],
  "usageLimits": [
    { "metric": "AI_TOKENS", "limit": 10000, "period": "month" }
  ],
  "addons": ["prod-addon-storage"],
  "providers": {}
}
```

**Response (200)**:

```json
{
  "productId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Errors**: `400` (validation/domain error), e.g. name too short, no entitlements, invalid type.

---

### GET /products — List products (paginated)

**Method**: `GET`  
**Path**: `/products`  
**Query parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page_number` | number | No | Page number (default: 1). |
| `page_size` | number | No | Page size (default: 20). |
| `type` | string | No | Filter by type: `one_off`, `subscription`, `addon`. |
| `active` | string | No | Filter by active: `"true"` or `"false"`. |

**Example**: `GET /products?page_number=1&page_size=20&type=subscription&active=true`

**Response (200)**:

```json
{
  "amount": 42,
  "data": [
    {
      "productId": "prod-uuid",
      "name": "Premium Plan",
      "description": "Monthly premium",
      "type": "subscription",
      "entitlements": ["AI_TOKENS", "access_dashboard"],
      "usageLimits": [{ "metric": "AI_TOKENS", "limit": 10000, "period": "month" }],
      "addons": ["prod-addon-storage"],
      "addonConfigs": [],
      "providers": { "stripe": "prod_xxx" },
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page_size": 20,
    "page_number": 1,
    "total_pages": 3
  }
}
```

---

### GET /products/search — Search products

**Method**: `GET`  
**Path**: `/products/search`  
**Query parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page_number` | number | No | Default: 1. |
| `page_size` | number | No | Default: 20. |
| `name_prefix` | string | No | Filter by name prefix. |
| `type` | string | No | `one_off`, `subscription`, `addon`. |
| `active` | string | No | `"true"` or `"false"`. |

**Example**: `GET /products/search?name_prefix=Premium&type=subscription`

**Response (200)**: Same shape as **GET /products** (amount, data, pagination).

---

### GET /products/{id} — Get product by ID

**Method**: `GET`  
**Path**: `/products/{id}`  
**Path parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Product ID. |

**Example**: `GET /products/550e8400-e29b-41d4-a716-446655440000`

**Response (200)**:

```json
{
  "productId": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Premium Plan",
  "description": "Monthly premium",
  "type": "subscription",
  "entitlements": ["AI_TOKENS", "access_dashboard"],
  "usageLimits": [{ "metric": "AI_TOKENS", "limit": 10000, "period": "month" }],
  "addons": ["prod-addon-storage"],
  "addonConfigs": [],
  "providers": { "stripe": "prod_xxx" },
  "isActive": true,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Errors**: `404` if product not found.

---

### PUT /products/{id} — Update product

**Method**: `PUT`  
**Path**: `/products/{id}`  
**Path parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Product ID. |

**Body**: Optional fields to update (partial update). All fields below are optional.

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | New name (min 3 characters). |
| `description` | string | New description. |
| `isActive` | boolean | Activate or deactivate. |
| `entitlements` | string[] | Replace/add entitlements (array is applied). |
| `usageLimits` | array | Usage limit objects (same shape as create). |
| `addons` | string[] | Add-on product IDs (subscriptions only). |
| `providers` | object | Provider map, merged with existing. |

**Example request body**:

```json
{
  "name": "Premium Plan v2",
  "description": "Updated description",
  "isActive": true,
  "providers": { "stripe": "prod_yyy" }
}
```

**Response (200)**:

```json
{
  "updated": true,
  "productId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Errors**: `404` if product not found; `400` for domain/validation errors.

---

### DELETE /products/{id} — Delete product

**Method**: `DELETE`  
**Path**: `/products/{id}`  
**Path parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Product ID. |

**Body**: None.

**Response (200)**:

```json
{
  "deleted": true,
  "productId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Errors**: `404` if product not found.

---

## 2. Pricing Service

**Base path**: `/prices`

All pricing endpoints require authentication.

---

### POST /prices — Create price

**Method**: `POST`  
**Path**: `/prices`  
**Body**: Required (JSON).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `productId` | string | Yes | Product this price belongs to. |
| `billingType` | string | Yes | `"recurring"` or `"one_time"`. |
| `amount` | number | Yes | Price amount (e.g. 9.99). |
| `currency` | string | Yes | 3-letter code (e.g. `"usd"`). |
| `interval` | string | If recurring | One of: `"day"`, `"week"`, `"month"`, `"year"`. |
| `frequency` | number | No | Billing frequency (default 1), e.g. 1 = every interval, 2 = every 2 intervals. |
| `providers` | object | No | e.g. `{ "stripe": "price_xxx" }`. |

For **one_time** prices, omit `interval`. For **recurring**, `interval` is required.

**Example request body (recurring)**:

```json
{
  "productId": "550e8400-e29b-41d4-a716-446655440000",
  "billingType": "recurring",
  "interval": "month",
  "frequency": 1,
  "amount": 9.99,
  "currency": "usd",
  "providers": {}
}
```

**Example request body (one-time)**:

```json
{
  "productId": "550e8400-e29b-41d4-a716-446655440000",
  "billingType": "one_time",
  "amount": 29.99,
  "currency": "usd"
}
```

**Response (200)**:

```json
{
  "priceId": "price-uuid-here"
}
```

**Errors**: `400` for validation (e.g. recurring without interval, negative amount, invalid currency).

---

### GET /prices/{id} — Get price by ID

**Method**: `GET`  
**Path**: `/prices/{id}`  
**Path parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Price ID. |

**Body**: None.  
**Query**: None.

**Response (200)**:

```json
{
  "priceId": "price-uuid",
  "productId": "prod-uuid",
  "billingType": "recurring",
  "interval": "month",
  "frequency": 1,
  "amount": 9.99,
  "currency": "usd",
  "providers": { "stripe": "price_xxx" },
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Errors**: `404` if price not found.

---

### GET /prices/product/{productId} — List prices for a product

**Method**: `GET`  
**Path**: `/prices/product/{productId}`  
**Path parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `productId` | string | Product ID. |

**Query parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page_number` | number | No | Default: 1. |
| `page_size` | number | No | Default: 20. |

**Example**: `GET /prices/product/prod-uuid?page_number=1&page_size=20`

**Response (200)**:

```json
{
  "amount": 2,
  "data": [
    {
      "priceId": "price-uuid-1",
      "productId": "prod-uuid",
      "billingType": "recurring",
      "interval": "month",
      "frequency": 1,
      "amount": 9.99,
      "currency": "usd",
      "providers": { "stripe": "price_xxx" },
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page_size": 20,
    "page_number": 1,
    "total_pages": 1
  }
}
```

---

### PUT /prices/{id} — Update price

**Method**: `PUT`  
**Path**: `/prices/{id}`  
**Path parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Price ID. |

**Body**: Optional (partial update).

| Field | Type | Description |
|-------|------|-------------|
| `amount` | number | New amount. |
| `currency` | string | 3-letter code. |
| `interval` | string | For recurring: `day`, `week`, `month`, `year`. |
| `frequency` | number | Billing frequency. |
| `providers` | object | Merged with existing. |

**Example request body**:

```json
{
  "amount": 12.99,
  "currency": "usd",
  "providers": { "stripe": "price_yyy" }
}
```

**Response (200)**:

```json
{
  "updated": true,
  "priceId": "price-uuid"
}
```

**Errors**: `404` if price not found.

---

### DELETE /prices/{id} — Delete price

**Method**: `DELETE`  
**Path**: `/prices/{id}`  
**Path parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Price ID. |

**Body**: None.  
**Query**: None.

**Response (200)**:

```json
{
  "deleted": true,
  "priceId": "price-uuid"
}
```

**Errors**: `404` if price not found.

---

## 3. Access Service (Entitlements)

**Base path**: `/access`

Used to read user entitlements and increment usage for usage-based entitlements. All endpoints require authentication (user is taken from JWT).

---

### GET /access — Get user entitlements

**Method**: `GET`  
**Path**: `/access`  
**Path parameters**: None.  
**Body**: None.

**Query parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `entitlement_key` | string | No | If set, returns only that entitlement key (same shape as single key). |

**Example**: `GET /access` or `GET /access?entitlement_key=AI_TOKENS`

**Response (200)** — all entitlements:

```json
{
  "userId": "user-123",
  "entitlements": {
    "AI_TOKENS": { "limit": 10000, "used": 2501 },
    "access_dashboard": true
  }
}
```

- For **usage-based** entitlements: `{ "limit": number, "used": number }`.
- For **boolean** entitlements: `true`.

**Response (200)** — when `entitlement_key=AI_TOKENS`:

```json
{
  "userId": "user-123",
  "entitlements": {
    "AI_TOKENS": { "limit": 10000, "used": 2501 }
  }
}
```

**Errors**: Missing/invalid auth returns 401/500.

---

### GET /access/:key — Get entitlement by key

**Method**: `GET`  
**Path**: `/access/{key}`  
**Path parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `key` | string | Entitlement key (e.g. `AI_TOKENS`, `access_dashboard`). |

**Note**: Route is `/access/:key`. Do not use `/access/usage/X` here; use **POST /access/usage/:key** for incrementing usage.

**Example**: `GET /access/AI_TOKENS`

**Response (200)**:

```json
{
  "userId": "user-123",
  "entitlements": {
    "AI_TOKENS": { "limit": 10000, "used": 2501 }
  }
}
```

Or for a boolean entitlement:

```json
{
  "userId": "user-123",
  "entitlements": {
    "access_dashboard": true
  }
}
```

**Errors**: `404` if entitlement not found or not active.

---

### POST /access/usage/:key — Increment usage

**Method**: `POST`  
**Path**: `/access/usage/{key}`  
**Path parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `key` | string | Entitlement key (e.g. `AI_TOKENS`). Must be usage-based. |

**Body**: Optional (JSON).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `amount` | number (integer) | No | Amount to add to usage (default: 1). Must be ≥ 1. |

**Example request body**:

```json
{
  "amount": 5
}
```

Or empty body `{}` for +1.

**Response (200)**:

```json
{
  "key": "AI_TOKENS",
  "usage": 2506,
  "limit": 10000,
  "remaining": 7494
}
```

- `usage`: current consumed usage after increment.  
- `limit`: effective limit (base + permanent from one-time purchases).  
- `remaining`: `limit - usage`.

If the requested increment would exceed the limit, usage is **capped at the limit**; response is still 200 with `usage = limit`, `remaining = 0` (no error).

**Errors**:
- `404`: Entitlement not found or not active.
- `400` (DOMAIN_ERROR): Entitlement is not usage-based.
- `401`: Not authenticated.

---

## 4. Stripe Service (Payment Intent, Methods, Portal)

**Base path**: `/stripe`

Endpoints for creating payment intents, listing payment methods, checking payment intent status, and creating the Stripe customer portal session. All except the webhook require authentication.

---

### POST /stripe/payment-intent — Create payment intent / checkout

**Method**: `POST`  
**Path**: `/stripe/payment-intent`  
**Body**: Required (JSON).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `priceId` | string | Yes | Price ID (from pricing service). |
| `successUrl` | string | Yes | Absolute URL to redirect after successful payment. |
| `cancelUrl` | string | Yes | Absolute URL if user cancels. |
| `addonProductIds` | string[] | No | Add-on product IDs to attach (subscriptions only). |
| `paymentMethodId` | string | No | Specific payment method to charge (e.g. `pm_xxx`). |

**Example request body**:

```json
{
  "priceId": "price-uuid-from-pricing-service",
  "successUrl": "https://yourapp.com/checkout/success",
  "cancelUrl": "https://yourapp.com/checkout/cancel",
  "addonProductIds": ["prod-addon-storage"],
  "paymentMethodId": "pm_xxx"
}
```

**Response (200)** — varies by flow:

**A) Checkout session (no payment method / redirect flow)**:

```json
{
  "checkoutUrl": "https://checkout.stripe.com/...",
  "paymentIntentId": "pi_xxx",
  "customerId": "cus_xxx",
  "isUpdate": false
}
```

Redirect the user to `checkoutUrl`.

**B) Direct payment / subscription with payment method** (may require 3DS):

```json
{
  "customerId": "cus_xxx",
  "paymentIntentId": "pi_xxx",
  "subscriptionId": "sub_xxx",
  "status": "succeeded",
  "clientSecret": "pi_xxx_secret_xxx",
  "requiresAction": false,
  "isProcessing": false,
  "nextAction": null,
  "isUpdate": false
}
```

**C) Requires action (e.g. 3D Secure)**:

```json
{
  "customerId": "cus_xxx",
  "paymentIntentId": "pi_xxx",
  "subscriptionId": "sub_xxx",
  "status": "requires_action",
  "clientSecret": "pi_xxx_secret_xxx",
  "requiresAction": true,
  "isProcessing": false,
  "nextAction": {
    "type": "complete_payment",
    "message": "Use Stripe.js with the clientSecret to complete 3D Secure authentication",
    "requiresClientSecret": true
  },
  "isUpdate": false
}
```

Use `clientSecret` with Stripe.js on the client to complete authentication.

**D) Processing (async)**:

```json
{
  "customerId": "cus_xxx",
  "paymentIntentId": "pi_xxx",
  "status": "processing",
  "requiresAction": false,
  "isProcessing": true,
  "nextAction": {
    "type": "poll_status",
    "pollEndpoint": "/stripe/payment-intent/pi_xxx/status",
    "estimatedCompletionTime": 30
  },
  "isUpdate": false
}
```

Poll `GET /stripe/payment-intent/:paymentIntentId/status` until status is final.

**E) Subscription update (user already had subscription)**:

```json
{
  "customerId": "cus_xxx",
  "subscriptionId": "sub_xxx",
  "isUpdate": true
}
```

**Errors**: `400` if `priceId`, `successUrl`, or `cancelUrl` missing; `401` if not authenticated.

---

### GET /stripe/payment-intent/:paymentIntentId/status — Get payment intent status

**Method**: `GET`  
**Path**: `/stripe/payment-intent/{paymentIntentId}/status`  
**Path parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `paymentIntentId` | string | Stripe Payment Intent ID (e.g. `pi_xxx`). |

**Body**: None.  
**Query**: None.

**Response (200)**:

```json
{
  "paymentIntentId": "pi_xxx",
  "status": "succeeded",
  "clientSecret": "pi_xxx_secret_xxx",
  "requiresAction": false,
  "isProcessing": false,
  "nextAction": {
    "type": "success",
    "message": "Payment completed successfully."
  }
}
```

Possible `status`: `succeeded`, `processing`, `requires_action`, `requires_payment_method`.  
`nextAction` can indicate: poll again (`shouldPoll`, `pollIntervalSeconds`), complete payment with `clientSecret`, retry with another payment method, or success.

**Errors**: `400` if `paymentIntentId` missing; `401` if not authenticated.

---

### GET /stripe/payment-methods — List payment methods

**Method**: `GET`  
**Path**: `/stripe/payment-methods`  
**Path parameters**: None.  
**Body**: None.  
**Query**: None.  
User is identified from JWT.

**Response (200)**:

```json
{
  "paymentMethods": [
    {
      "id": "pm_xxx",
      "type": "card",
      "card": {
        "brand": "visa",
        "last4": "4242",
        "expMonth": 12,
        "expYear": 2025
      },
      "isDefault": true
    }
  ]
}
```

If the user has no Stripe customer, `paymentMethods` is `[]`.

---

### POST /stripe/customer-portal — Create customer portal session

**Method**: `POST`  
**Path**: `/stripe/customer-portal`  
**Body**: Required (JSON). Alternatively `returnUrl` can be sent as query param.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `returnUrl` | string | Yes | Absolute URL to redirect after user leaves the Stripe portal. |

**Example request body**:

```json
{
  "returnUrl": "https://yourapp.com/settings/billing"
}
```

**Response (200)**:

```json
{
  "url": "https://billing.stripe.com/session/..."
}
```

Redirect the user to `url` to manage payment methods, invoices, and subscription.

**Errors**: `404` (NotFoundError) if user has no Stripe customer (complete a purchase first). `400` if `returnUrl` missing.

---

### POST /stripe/webhook — Stripe webhook

**Method**: `POST`  
**Path**: `/stripe/webhook`  
**Auth**: No JWT. Verified via Stripe signature.  
**Body**: Raw Stripe webhook payload (Stripe sends this).  
**Response**: Handled by Stripe SDK (e.g. 200 on success).  
Not for direct client use; Stripe calls this endpoint.

---

## 5. Trial Service

**Base path**: `/trial`

All endpoints require authentication.

---

### POST /trial — Start trial

**Method**: `POST`  
**Path**: `/trial`  
**Body**: Required (JSON).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `productId` | string | Yes | Product to start trial for. |
| `trialDurationHours` | number | No | Trial length in hours (default: 3). |
| `role` | string | No | Role for entitlement (e.g. `learner`). |

**Example request body**:

```json
{
  "productId": "550e8400-e29b-41d4-a716-446655440000",
  "trialDurationHours": 3,
  "role": "learner"
}
```

**Response (200)**:

```json
{
  "trialId": "user-123-550e8400-e29b-41d4-a716-446655440000",
  "expiresAt": "2024-01-01T03:00:00.000Z"
}
```

**Errors**: Domain error if user already trialed this product; product not found or inactive.

---

### GET /trial — Check trial status

**Method**: `GET`  
**Path**: `/trial`  
**Body**: None.

**Query parameters** (one of these is required):

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `productId` | string | Yes* | Product ID to check trial for. |

*Alternatively, some deployments may support `productId` in path; if so, path param would be used when provided.

**Example**: `GET /trial?productId=550e8400-e29b-41d4-a716-446655440000`

**Response (200)** — has trialed:

```json
{
  "hasTrialed": true,
  "trial": {
    "startedAt": "2024-01-01T00:00:00.000Z",
    "expiresAt": "2024-01-01T03:00:00.000Z",
    "status": "active",
    "isActive": true
  }
}
```

`status` can be: `"active"`, `"expired"`, `"converted"`.

**Response (200)** — never trialed:

```json
{
  "hasTrialed": false
}
```

**Errors**: Missing `productId` or user ID.

---

## 6. Transaction Service

**Base path**: `/transactions`

Requires authentication. Admin can optionally filter by another user’s `userId`.

---

### GET /transactions — Get user transactions

**Method**: `GET`  
**Path**: `/transactions`  
**Body**: None.

**Query parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | string | No | Filter by user ID. **Admin only**; non-admin can only see own data (or gets Unauthorized). |
| `limit` | number | No | Max number of transactions to return. |

**Example**: `GET /transactions` or `GET /transactions?userId=user-123&limit=50` (admin).

**Response (200)**:

```json
{
  "userId": "user-123",
  "transactions": [
    {
      "transactionId": "pi_xxx",
      "type": "payment.successful",
      "status": "success",
      "amount": 999,
      "currency": "usd",
      "productId": "prod_xxx",
      "priceId": "price_xxx",
      "subscriptionId": "sub_xxx",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "metadata": {}
    }
  ],
  "count": 10
}
```

**Transaction types**: `payment.successful`, `payment.failed`, `payment.action_required`, `subscription.created`, `subscription.updated`, `subscription.canceled`, `subscription.expired`.  
**Status**: `success`, `failed`, `pending`, `action_required`.

---

## 7. Dunning Service

**Base path**: `/dunning`

Returns the user’s billing issue state (e.g. payment failed, action required, grace period, restricted, suspended). Requires authentication.

---

### GET /dunning/billing-issue — Get billing issue status

**Method**: `GET`  
**Path**: `/dunning/billing-issue`  
**Path parameters**: None.  
**Body**: None.  
**Query**: None.  
User is identified from JWT.

**Response (200)** — no issue:

```json
{
  "hasIssue": false,
  "state": "ok",
  "message": "No billing issues",
  "daysSinceDetection": 0,
  "actions": []
}
```

**Response (200)** — has issue:

```json
{
  "hasIssue": true,
  "state": "action_required",
  "message": "Payment action required. Please update your payment method to continue.",
  "portalUrl": "https://billing.stripe.com/...",
  "expiresAt": "2024-01-15T00:00:00.000Z",
  "daysSinceDetection": 1,
  "actions": [
    "Update your payment method using the portal link",
    "Contact support if you need assistance"
  ]
}
```

**States**: `ok`, `action_required`, `grace_period`, `restricted`, `suspended`.  
Use `portalUrl` to send the user to Stripe billing portal to fix payment.

---

## 8. Auth Service

**Base path**: `/auth`

---

### POST /auth/google — Authenticate with Google OAuth

**Method**: `POST`  
**Path**: `/auth/google`  
**Auth**: Not required (this call returns the JWT).  
**Body**: Required (JSON).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | string | Yes | OAuth authorization code from Google redirect. |
| `role` | string | No | Role (e.g. `learner`). |
| `preferredLanguage` | string | No | Preferred language code. |
| `redirectUri` | string | No | Must match the redirect URI used in the authorization request. |

**Example request body**:

```json
{
  "code": "4/0A...",
  "role": "learner",
  "preferredLanguage": "en",
  "redirectUri": "https://yourapp.com/api/auth/callback"
}
```

**Response (200)**:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "userId": "user-123456789",
    "email": "user@example.com",
    "name": "John Doe",
    "picture": "https://...",
    "role": "learner",
    "preferredLanguage": "en"
  }
}
```

Use `token` in `Authorization: Bearer <token>` for other endpoints.

---

### GET /auth/me — Get current user profile

**Method**: `GET`  
**Path**: `/auth/me`  
**Auth**: Required.  
**Body**: None.  
**Query**: None.

**Response (200)**:

```json
{
  "userId": "user-123",
  "email": "user@example.com",
  "name": "John Doe",
  "picture": "https://...",
  "role": "learner",
  "preferredLanguage": "en",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Errors**: 404/500 if user not found or invalid token.

---

### PUT /auth/user/preferred-language — Update preferred language

**Method**: `PUT`  
**Path**: `/auth/user/preferred-language`  
**Auth**: Required.  
**Body**: Required (JSON).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `preferredLanguage` | string | Yes | New preferred language code. |

**Example request body**:

```json
{
  "preferredLanguage": "es"
}
```

**Response (200)**:

```json
{
  "userId": "user-123",
  "preferredLanguage": "es"
}
```

---

## 9. Entitlement & Usage Event Services (No HTTP API)

- **Entitlement service**: Consumes billing events from SNS/SQS and updates entitlements (create/update/revoke). It does **not** expose HTTP endpoints; access to entitlements is via the **Access Service** above.
- **Usage event service**: Consumes usage events from SQS (e.g. from your app sending messages to the usage-event queue). It does **not** expose HTTP endpoints. To record usage that affects usage-based entitlements, use **POST /access/usage/:key** in the Access Service, or send messages to the usage-event queue as documented in `api-and-events-reference.md`.

---

## Quick reference table

| Service   | Base      | Key endpoints |
|----------|-----------|----------------|
| Products | `/products` | POST/GET/PUT/DELETE product, GET list, GET search |
| Pricing  | `/prices`   | POST/GET/PUT/DELETE price, GET by product |
| Access   | `/access`   | GET entitlements, GET by key, POST usage increment |
| Stripe   | `/stripe`   | POST payment-intent, GET payment-methods, GET payment-intent status, POST customer-portal, POST webhook |
| Trial    | `/trial`    | POST start trial, GET trial status |
| Transactions | `/transactions` | GET list (optional userId, limit) |
| Dunning  | `/dunning`  | GET billing-issue |
| Auth     | `/auth`     | POST google, GET me, PUT user/preferred-language |

For SNS topics, SQS queues, and event payloads, see **api-and-events-reference.md**.

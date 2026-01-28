# Product Service

A serverless Lambda function service for managing products in an education payment platform. This service handles CRUD operations for products, including subscriptions, one-off purchases, and add-ons.

## Overview

The Product Service is an AWS Lambda function that processes API Gateway events to manage product data stored in DynamoDB. It provides a RESTful API for creating, reading, updating, deleting, listing, and searching products.

### Features

- **Product Management**: Full CRUD operations for products
- **Product Types**: Supports subscription, one-off, and addon product types
- **Search & Filter**: Search products by name prefix and filter by type/status
- **Pagination**: Paginated list responses with configurable page size
- **Domain-Driven Design**: Clean architecture with domain entities, use cases, and repositories

## Architecture

The service follows a clean architecture pattern:

```
src/
├── domain/           # Domain entities and business logic
├── app/             # Application layer (use cases, controllers)
│   ├── controllers/ # Request handlers
│   ├── usecases/    # Business logic orchestration
│   └── ports/       # Repository interfaces
├── dynamodb/        # Infrastructure layer (DynamoDB implementation)
└── handler/         # Lambda handler and API Gateway integration
```

## Environment Variables

The service requires the following environment variables:

### Required

- `PRODUCTS_TABLE` - Name of the DynamoDB table storing products

### Example `.env` file

```bash
# DynamoDB Configuration
PRODUCTS_TABLE=products-table-dev

# AWS Configuration (if running locally)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
```

### Setting Environment Variables

**For Local Development:**
```bash
# Create a .env file in the service root
echo "PRODUCTS_TABLE=products-table-dev" > .env
```

**For AWS Lambda:**
Set environment variables in your Lambda function configuration or use AWS Systems Manager Parameter Store / AWS Secrets Manager.

## Getting Started

### Prerequisites

- Node.js 18+ (or as specified in your project)
- pnpm 10.15.0 (or compatible version)
- AWS CLI configured (for DynamoDB access)
- DynamoDB table created with appropriate schema

### Installation

```bash
# Install dependencies
pnpm install
```

### Building the Service

```bash
# Build TypeScript to JavaScript
pnpm run build

# Build in watch mode (auto-rebuild on changes)
pnpm run build:watch

# Type check without building
pnpm run type-check

# Clean build artifacts
pnpm run clean
```

### Running Locally

This is a Lambda function, so it's designed to run in AWS Lambda. For local development:

1. **Build the service:**
   ```bash
   pnpm run build
   ```

2. **Use a local Lambda runtime or API Gateway emulator:**
   - [SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html)
   - [Serverless Framework](https://www.serverless.com/)
   - [LocalStack](https://localstack.cloud/)

3. **Development mode with auto-rebuild:**
   ```bash
   # Watch for changes and rebuild
   pnpm run dev
   ```

### DynamoDB Table Schema

The service expects a DynamoDB table with the following structure:

**Primary Key:**
- `PK` (Partition Key): `PRODUCT#{productId}`
- `SK` (Sort Key): `METADATA`

**Global Secondary Index (GSI1):**
- `GSI1PK` (Partition Key): `TYPE#{productType}`
- `GSI1SK` (Sort Key): `CREATED#{timestamp}`

**Required Attributes:**
- `productId` (String)
- `name` (String)
- `type` (String): `subscription`, `one_off`, or `addon`
- `entitlements` (List of Strings)
- `isActive` (Boolean)
- `createdAt` (String - ISO 8601)
- `updatedAt` (String - ISO 8601)

**Optional Attributes:**
- `description` (String)
- `usageLimits` (List of Objects)
- `addons` (List of Strings)

## API Endpoints

### List Products
```
GET /products
```

**Query Parameters:**
- `page_number` (optional, default: 1) - Page number (1-based)
- `page_size` (optional, default: 20) - Items per page
- `type` (optional) - Filter by product type: `subscription`, `one_off`, or `addon`
- `active` (optional) - Filter by active status: `true` or `false`

**Response:**
```json
{
  "amount": 35,
  "data": [
    {
      "productId": "prod-123",
      "name": "Premium Subscription",
      "description": "Monthly premium subscription",
      "type": "subscription",
      "entitlements": ["feature.analytics", "feature.reports"],
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page_size": 20,
    "page_number": 1,
    "total_pages": 2
  }
}
```

### Search Products
```
GET /products/search
```

**Query Parameters:**
- `name_prefix` (required) - Search products by name prefix
- `page_number` (optional, default: 1)
- `page_size` (optional, default: 20)
- `type` (optional) - Filter by product type
- `active` (optional) - Filter by active status

**Response:** Same format as List Products

### Get Product
```
GET /products/{id}
```

**Response:**
```json
{
  "productId": "prod-123",
  "name": "Premium Subscription",
  "description": "Monthly premium subscription",
  "type": "subscription",
  "entitlements": ["feature.analytics"],
  "usageLimits": [],
  "addons": [],
  "isActive": true,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### Create Product
```
POST /products
```

**Request Body:**
```json
{
  "name": "Premium Subscription",
  "description": "Monthly premium subscription",
  "type": "subscription",
  "entitlements": ["feature.analytics", "feature.reports"],
  "usageLimits": [],
  "addons": []
}
```

**Response:**
```json
{
  "productId": "generated-uuid"
}
```

### Update Product
```
PUT /products/{id}
```

**Request Body:**
```json
{
  "name": "Updated Product Name",
  "description": "Updated description",
  "isActive": true,
  "entitlements": ["feature.analytics", "feature.reports", "feature.advanced"]
}
```

**Response:**
```json
{
  "updated": true,
  "productId": "prod-123"
}
```

### Delete Product
```
DELETE /products/{id}
```

**Response:** `204 No Content`

## Usage Management

Usage limits allow you to track and limit resource consumption for entitlements. When a product is purchased, usage limits are automatically synced to user entitlements and can be tracked and enforced in your application.

### Understanding Usage Limits

Usage limits define:
- **What** resource is being tracked (metric name, e.g., `ai_tokens`, `quiz_attempts`)
- **How much** can be consumed (limit, e.g., 10000)
- **When** it resets (period: `day`, `week`, `month`, `year`, `billing_cycle`, `lifetime`)

### Defining Usage Limits in Products

Usage limits are defined in the `usageLimits` array when creating or updating a product:

```json
{
  "name": "Premium Subscription",
  "type": "subscription",
  "entitlements": ["ai_tokens", "quiz_attempts"],
  "usageLimits": [
    {
      "metric": "ai_tokens",
      "limit": 10000,
      "period": "month"
    },
    {
      "metric": "quiz_attempts",
      "limit": 50,
      "period": "billing_cycle"
    }
  ]
}
```

### Usage Limit Structure

```typescript
interface UsageLimit {
  metric: string;        // Resource identifier (e.g., "ai_tokens", "quiz_attempts", "api_calls")
  limit: number;         // Maximum allowed consumption (e.g., 10000)
  period: UsagePeriod;   // Reset period: "day" | "week" | "month" | "year" | "billing_cycle" | "lifetime"
  window?: UsageWindow;  // Reset window: "calendar" | "rolling" | "billing" | "custom" (default: "calendar")
  startDate?: Date;      // For custom windows
}
```

### Supported Reset Periods

| Period | Description | Reset Behavior |
|--------|-------------|----------------|
| `day` | Daily limit | Resets at midnight (calendar) or every 24 hours (rolling) |
| `week` | Weekly limit | Resets on Sunday (calendar) or every 7 days (rolling) |
| `month` | Monthly limit | Resets on the 1st of each month (calendar) or every 30 days (rolling) |
| `year` | Yearly limit | Resets on January 1st (calendar) or every 365 days (rolling) |
| `billing_cycle` | Billing cycle | Resets when subscription renews (aligned with subscription period) |
| `lifetime` | Lifetime limit | Never resets (total lifetime consumption) |

### Usage Windows

| Window | Description | Example |
|--------|-------------|---------|
| `calendar` | Fixed calendar periods | Jan 1-31, Feb 1-28, etc. |
| `rolling` | Rolling window from current date | Last 30 days from today |
| `billing` | Aligned with subscription billing date | Resets on subscription renewal date |
| `custom` | Custom start date + period | Defined by `startDate` |

### Example Usage Limit Configurations

**Daily AI Token Limit:**
```json
{
  "metric": "ai_tokens",
  "limit": 10000,
  "period": "day",
  "window": "calendar"
}
```

**Monthly Quiz Attempts (Rolling Window):**
```json
{
  "metric": "quiz_attempts",
  "limit": 50,
  "period": "month",
  "window": "rolling"
}
```

**Billing Cycle API Calls:**
```json
{
  "metric": "api_calls",
  "limit": 5000,
  "period": "billing_cycle"
}
```

**Lifetime Course Access:**
```json
{
  "metric": "course_access",
  "limit": 100,
  "period": "lifetime"
}
```

### How Usage Works

1. **Product Definition**: Define usage limits in your product's `usageLimits` array
2. **Automatic Sync**: When a user purchases a product, usage limits are automatically synced to their entitlements
3. **Usage Tracking**: Track usage by calling the entitlement service to increment usage
4. **Automatic Resets**: Usage automatically resets based on the defined period and window
5. **Add-on Limits**: Add-on products add to base product limits (additive), not replace them

### Checking Usage

Usage is tracked in user entitlements. To check usage:

1. **Get User Entitlements** (via Entitlement Service):
   ```bash
   GET /entitlements?userId={userId}
   ```

2. **Response includes usage information:**
   ```json
   {
     "entitlements": [
       {
         "key": "ai_tokens",
         "status": "active",
         "usage": {
           "limit": 10000,
           "used": 3500,
           "resetAt": "2024-02-01T00:00:00.000Z"
         }
       }
     ]
   }
   ```

### Incrementing Usage

To track consumption, increment usage through the Entitlement Service:

```bash
PUT /entitlements/{userId}/{entitlementKey}
{
  "usageIncrement": 100
}
```

The entitlement service will:
- Check if usage can be consumed (`used + increment <= limit`)
- Increment the `used` counter
- Throw an error if the limit would be exceeded

### Usage Reset Behavior

Usage resets automatically based on the reset strategy:

- **Periodic Resets** (`day`, `week`, `month`, `year`): Reset at the start of each period
- **Billing Cycle**: Reset when subscription renews (aligned with `currentPeriodEnd`)
- **Lifetime**: Never resets

The system checks for resets:
- When entitlements are accessed
- When usage is incremented
- When subscription renewals occur

### Complete Product Example with Usage Limits

```json
{
  "name": "Premium Plan",
  "description": "Monthly premium subscription with AI features",
  "type": "subscription",
  "entitlements": [
    "access_dashboard",
    "access_analytics",
    "ai_tokens",
    "quiz_attempts"
  ],
  "usageLimits": [
    {
      "metric": "ai_tokens",
      "limit": 10000,
      "period": "month",
      "window": "calendar"
    },
    {
      "metric": "quiz_attempts",
      "limit": 50,
      "period": "billing_cycle"
    },
    {
      "metric": "api_calls",
      "limit": 5000,
      "period": "month",
      "window": "rolling"
    }
  ],
  "isActive": true
}
```

### Best Practices

1. **Metric Naming**: Use clear, consistent metric names (e.g., `ai_tokens`, `quiz_attempts`, `api_calls`)
2. **Limit Sizing**: Set realistic limits based on your business model
3. **Reset Periods**: Choose reset periods that align with your billing cycles
4. **Add-on Limits**: Remember that add-on limits are additive to base product limits
5. **Lifetime Limits**: Use `lifetime` period for one-time purchases or permanent limits

### Related Services

- **Entitlement Service**: Manages user entitlements and usage tracking
- **Pricing Service**: Defines pricing for products
- **Stripe Service**: Handles payment processing and subscription management

## Testing

### Running Tests

```bash
# Run all tests
pnpm run test

# Run tests in watch mode (auto-rerun on changes)
pnpm run test:watch

# Run tests with coverage report
pnpm run test:coverage
```

### Test Structure

Tests are located in `src/__tests__/`:

```
src/__tests__/
├── handler.test.ts                    # Main Lambda handler tests
├── helpers/
│   ├── api-gateway-event-factory.ts   # API Gateway event fixtures
│   └── product-fixtures.ts            # Product test data fixtures
├── setup.ts                           # Test environment setup
└── README.md                          # Test documentation
```

### Writing Tests

#### 1. Test Helper Utilities

The test suite includes helper utilities for creating test data:

**API Gateway Event Factory:**
```typescript
import { ApiGatewayEventFactory } from './helpers/api-gateway-event-factory';

// Create a GET request event
const event = ApiGatewayEventFactory.createGetEvent('/products', {
  page_number: '1',
  page_size: '10'
});

// Create a POST request event
const event = ApiGatewayEventFactory.createPostEvent('/products', {
  name: 'Test Product',
  type: 'subscription',
  entitlements: ['feature.analytics']
});

// Create a PUT request event with path parameters
const event = ApiGatewayEventFactory.createPutEvent('/products/{id}', {
  name: 'Updated Name'
}, { id: 'prod-123' });

// Create a DELETE request event
const event = ApiGatewayEventFactory.createDeleteEvent('/products/{id}', {
  id: 'prod-123'
});
```

**Product Fixtures:**
```typescript
import { ProductFixtures } from './helpers/product-fixtures';

// Create a Product entity
const product = ProductFixtures.createProduct({
  productId: 'prod-123',
  name: 'Test Product',
  type: ProductType.SUBSCRIPTION
});

// Create DynamoDB item format
const item = ProductFixtures.createProductItem({
  productId: 'prod-123',
  name: 'Test Product'
});

// Create a list of products
const products = ProductFixtures.createProductList(5);
```

#### 2. Mocking DynamoDB

The test suite automatically mocks AWS SDK DynamoDB operations:

```typescript
import { handler } from '../handler';
import { mockSendFn } from '@aws-sdk/lib-dynamodb';

describe('My Test', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.PRODUCTS_TABLE = 'test-table';
  });

  it('should handle a request', async () => {
    // Mock DynamoDB response
    mockSendFn.mockResolvedValueOnce({
      Items: ProductFixtures.createProductList(3),
      LastEvaluatedKey: undefined,
    });

    const event = ApiGatewayEventFactory.createGetEvent('/products');
    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    expect(mockSendFn).toHaveBeenCalled();
  });
});
```

#### 3. Example Test

```typescript
import { handler } from '../handler';
import { ApiGatewayEventFactory } from './helpers/api-gateway-event-factory';
import { ProductFixtures } from './helpers/product-fixtures';
import { mockSendFn } from '@aws-sdk/lib-dynamodb';

describe('GET /products', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.PRODUCTS_TABLE = 'test-table';
  });

  it('should return paginated list of products', async () => {
    // Arrange
    const products = ProductFixtures.createProductList(3);
    mockSendFn.mockResolvedValueOnce({
      Items: products,
      LastEvaluatedKey: undefined,
    });

    const event = ApiGatewayEventFactory.createGetEvent('/products', {
      page_number: '1',
      page_size: '10',
    });

    // Act
    const result = await handler(event);

    // Assert
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('pagination');
    expect(body.data).toHaveLength(3);
    expect(body.pagination.page_size).toBe(10);
    expect(body.pagination.page_number).toBe(1);
  });

  it('should return 404 for unknown routes', async () => {
    const event = ApiGatewayEventFactory.createGetEvent('/unknown/route');
    const result = await handler(event);

    expect(result.statusCode).toBe(404);
    const body = JSON.parse(result.body);
    expect(body.message).toBe('Route not found');
  });
});
```

#### 4. Testing Error Scenarios

```typescript
it('should handle DynamoDB errors', async () => {
  mockSendFn.mockRejectedValueOnce(new Error('DynamoDB error'));

  const event = ApiGatewayEventFactory.createGetEvent('/products');
  const result = await handler(event);

  expect(result.statusCode).toBe(500);
  const body = JSON.parse(result.body);
  expect(body.error).toBe('INTERNAL_SERVER_ERROR');
});

it('should return 404 when product not found', async () => {
  mockSendFn.mockResolvedValueOnce({ Item: undefined });

  const event = ApiGatewayEventFactory.createGetEvent('/products/{id}');
  event.pathParameters = { id: 'non-existent' };
  event.resource = '/products/{id}';

  const result = await handler(event);

  expect(result.statusCode).toBe(404);
  const body = JSON.parse(result.body);
  expect(body.error).toBe('NOT_FOUND');
});
```

### Test Coverage

The test suite covers:
- ✅ All API endpoints (GET, POST, PUT, DELETE, SEARCH)
- ✅ Pagination and filtering
- ✅ Error handling (404, 400, 500)
- ✅ DynamoDB integration (mocked)
- ✅ Response format validation
- ✅ Edge cases and validation errors

View coverage report:
```bash
pnpm run test:coverage
```

Coverage reports are generated in the `coverage/` directory.

## Deployment

### Building for Production

```bash
# Build the service
pnpm run build

# The compiled JavaScript will be in dist/
```

### Deploying to AWS Lambda

1. **Package the function:**
   ```bash
   pnpm run build
   zip -r function.zip dist node_modules
   ```

2. **Deploy using your preferred method:**
   - AWS SAM
   - Serverless Framework
   - AWS CDK
   - Terraform
   - Manual upload via AWS Console

3. **Set environment variables** in your Lambda function configuration:
   - `PRODUCTS_TABLE`: Your DynamoDB table name

## Development Scripts

| Script | Description |
|--------|-------------|
| `pnpm run build` | Compile TypeScript to JavaScript |
| `pnpm run build:watch` | Watch mode for TypeScript compilation |
| `pnpm run dev` | Development mode with nodemon (auto-rebuild) |
| `pnpm run test` | Run all tests |
| `pnpm run test:watch` | Run tests in watch mode |
| `pnpm run test:coverage` | Run tests with coverage report |
| `pnpm run type-check` | Type check without emitting files |
| `pnpm run clean` | Remove build artifacts |

## Project Structure

```
product-service/
├── src/
│   ├── domain/              # Domain layer (entities, value objects, errors)
│   ├── app/                 # Application layer
│   │   ├── controllers/     # Request handlers
│   │   ├── usecases/        # Business logic
│   │   └── ports/           # Repository interfaces
│   ├── dynamodb/            # DynamoDB repository implementation
│   ├── handler/             # Lambda handler
│   └── __tests__/           # Test files
├── dist/                    # Compiled JavaScript (generated)
├── coverage/                # Test coverage reports (generated)
├── package.json
├── tsconfig.json
├── jest.config.js
└── README.md
```

## License

ISC

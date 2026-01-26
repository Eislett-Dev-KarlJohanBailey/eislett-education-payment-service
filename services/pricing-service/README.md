# Pricing Service

A serverless Lambda function service for managing pricing information in an education payment platform. This service handles CRUD operations for prices, including recurring and one-time billing with support for various intervals and frequencies.

## Overview

The Pricing Service is an AWS Lambda function that processes API Gateway events to manage pricing data stored in DynamoDB. It provides a RESTful API for creating, reading, updating, deleting, and listing prices by product ID.

### Features

- **Price Management**: Full CRUD operations for prices
- **Billing Types**: Supports recurring and one-time billing
- **Intervals**: Supports day, week, month, and year intervals
- **Frequency**: Supports custom frequency (e.g., bi-monthly, quarterly)
- **Product Association**: Prices can be queried by product ID
- **Provider Integration**: Supports multiple payment providers per price
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

- `PRICES_TABLE` - Name of the DynamoDB table storing prices

### Example `.env` file

```bash
# DynamoDB Configuration
PRICES_TABLE=prices-table-dev

# AWS Configuration (if running locally)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
```

### Setting Environment Variables

**For Local Development:**
```bash
# Create a .env file in the service root
echo "PRICES_TABLE=prices-table-dev" > .env
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
- `PK` (Partition Key): `PRICE#{priceId}`
- `SK` (Sort Key): `METADATA`

**Global Secondary Index (GSI1):**
- `GSI1PK` (Partition Key): `PRODUCT#{productId}`
- `GSI1SK` (Sort Key): `CREATED#{timestamp}`

**Required Attributes:**
- `priceId` (String)
- `productId` (String)
- `billingType` (String): `recurring` or `one_time`
- `amount` (Number)
- `currency` (String): 3-letter currency code (e.g., USD, EUR)
- `createdAt` (String - ISO 8601)
- `updatedAt` (String - ISO 8601)

**Optional Attributes:**
- `interval` (String): Required for recurring billing - `day`, `week`, `month`, or `year`
- `frequency` (Number): Defaults to 1 (e.g., 2 for bi-monthly)
- `providers` (Object): Map of provider names to provider IDs

## API Endpoints

### List Prices by Product
```
GET /prices/product/{productId}
```

**Path Parameters:**
- `productId` (required) - The product ID to list prices for

**Query Parameters:**
- `page_number` (optional, default: 1) - Page number (1-based)
- `page_size` (optional, default: 20) - Items per page

**Response:**
```json
{
  "amount": 3,
  "data": [
    {
      "priceId": "price-123",
      "productId": "prod-123",
      "billingType": "recurring",
      "interval": "month",
      "frequency": 1,
      "amount": 2000,
      "currency": "USD",
      "providers": {
        "stripe": "price_stripe_123",
        "paypal": "price_paypal_456"
      },
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

### Get Price
```
GET /prices/{id}
```

**Path Parameters:**
- `id` (required) - The price ID

**Response:**
```json
{
  "priceId": "price-123",
  "productId": "prod-123",
  "billingType": "recurring",
  "interval": "month",
  "frequency": 1,
  "amount": 2000,
  "currency": "USD",
  "providers": {
    "stripe": "price_stripe_123",
    "paypal": "price_paypal_456"
  },
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### Create Price
```
POST /prices
```

**Request Body:**
```json
{
  "productId": "prod-123",
  "billingType": "recurring",
  "interval": "month",
  "frequency": 1,
  "amount": 2000,
  "currency": "USD",
  "providers": {
    "stripe": "price_stripe_123",
    "paypal": "price_paypal_456"
  }
}
```

**Note:** 
- For `billingType: "recurring"`, `interval` is required
- For `billingType: "one_time"`, `interval` should be omitted
- `frequency` defaults to 1 if not provided

**Response:**
```json
{
  "priceId": "generated-uuid"
}
```

### Update Price
```
PUT /prices/{id}
```

**Path Parameters:**
- `id` (required) - The price ID

**Request Body:**
```json
{
  "amount": 2500,
  "currency": "USD",
  "interval": "month",
  "frequency": 2,
  "providers": {
    "stripe": "price_stripe_updated_123"
  }
}
```

**Response:**
```json
{
  "updated": true,
  "priceId": "price-123"
}
```

### Delete Price
```
DELETE /prices/{id}
```

**Path Parameters:**
- `id` (required) - The price ID

**Response:** `204 No Content`

## Billing Types and Intervals

### Recurring Billing

For recurring billing, you must specify an `interval`:

- **Day**: `"interval": "day"` - Daily recurring charges
- **Week**: `"interval": "week"` - Weekly recurring charges
- **Month**: `"interval": "month"` - Monthly recurring charges
- **Year**: `"interval": "year"` - Yearly recurring charges

**Frequency Examples:**
- `frequency: 1` with `interval: "month"` = Monthly
- `frequency: 2` with `interval: "month"` = Bi-monthly (every 2 months)
- `frequency: 3` with `interval: "month"` = Quarterly (every 3 months)
- `frequency: 6` with `interval: "month"` = Semi-annually (every 6 months)

### One-Time Billing

For one-time billing, omit the `interval` field:

```json
{
  "productId": "prod-123",
  "billingType": "one_time",
  "amount": 5000,
  "currency": "USD"
}
```

## Provider Integration

Prices can be associated with multiple payment providers. Each provider maps a provider name to a provider-specific price ID:

```json
{
  "providers": {
    "stripe": "price_1ABC123",
    "paypal": "PP-123456",
    "square": "sq_price_789"
  }
}
```

Provider names are case-insensitive and will be normalized to lowercase.

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
│   └── price-fixtures.ts              # Price test data fixtures
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
const event = ApiGatewayEventFactory.createGetEvent('/prices/product/prod-123', {
  page_number: '1',
  page_size: '10'
});

// Create a POST request event
const event = ApiGatewayEventFactory.createPostEvent('/prices', {
  productId: 'prod-123',
  billingType: 'recurring',
  interval: 'month',
  amount: 2000,
  currency: 'USD'
});

// Create a PUT request event with path parameters
const event = ApiGatewayEventFactory.createPutEvent('/prices/{id}', {
  amount: 2500
}, { id: 'price-123' });

// Create a DELETE request event
const event = ApiGatewayEventFactory.createDeleteEvent('/prices/{id}', {
  id: 'price-123'
});
```

**Price Fixtures:**
```typescript
import { PriceFixtures } from './helpers/price-fixtures';

// Create a Price entity
const price = PriceFixtures.createPrice({
  priceId: 'price-123',
  productId: 'prod-123',
  billingType: BillingType.RECURRING,
  interval: Interval.MONTH
});

// Create DynamoDB item format
const item = PriceFixtures.createPriceItem({
  priceId: 'price-123',
  productId: 'prod-123'
});

// Create a list of prices
const prices = PriceFixtures.createPriceList(5);
```

#### 2. Mocking DynamoDB

The test suite automatically mocks AWS SDK DynamoDB operations:

```typescript
import { handler } from '../handler';
import { mockSendFn } from '@aws-sdk/lib-dynamodb';

describe('My Test', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.PRICES_TABLE = 'test-table';
  });

  it('should handle a request', async () => {
    // Mock DynamoDB response
    mockSendFn.mockResolvedValueOnce({
      Items: PriceFixtures.createPriceList(3),
      LastEvaluatedKey: undefined,
    });

    const event = ApiGatewayEventFactory.createGetEvent('/prices/product/prod-123');
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
import { PriceFixtures } from './helpers/price-fixtures';
import { mockSendFn } from '@aws-sdk/lib-dynamodb';

describe('GET /prices/product/{productId}', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.PRICES_TABLE = 'test-table';
  });

  it('should return paginated list of prices for a product', async () => {
    // Arrange
    const prices = PriceFixtures.createPriceList(3);
    mockSendFn.mockResolvedValueOnce({
      Items: prices,
      LastEvaluatedKey: undefined,
    });

    const event = ApiGatewayEventFactory.createGetEvent('/prices/product/prod-123', {
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

  const event = ApiGatewayEventFactory.createGetEvent('/prices/product/prod-123');
  const result = await handler(event);

  expect(result.statusCode).toBe(500);
  const body = JSON.parse(result.body);
  expect(body.error).toBe('INTERNAL_SERVER_ERROR');
});

it('should return 404 when price not found', async () => {
  mockSendFn.mockResolvedValueOnce({ Item: undefined });

  const event = ApiGatewayEventFactory.createGetEvent('/prices/{id}');
  event.pathParameters = { id: 'non-existent' };
  event.resource = '/prices/{id}';

  const result = await handler(event);

  expect(result.statusCode).toBe(404);
  const body = JSON.parse(result.body);
  expect(body.error).toBe('NOT_FOUND');
});

it('should validate recurring billing requires interval', async () => {
  const event = ApiGatewayEventFactory.createPostEvent('/prices', {
    productId: 'prod-123',
    billingType: 'recurring',
    // Missing interval
    amount: 2000,
    currency: 'USD'
  });

  const result = await handler(event);

  expect(result.statusCode).toBe(400);
  const body = JSON.parse(result.body);
  expect(body.error).toBe('DOMAIN_ERROR');
});
```

### Test Coverage

The test suite covers:
- ✅ All API endpoints (GET, POST, PUT, DELETE)
- ✅ Pagination and filtering by product ID
- ✅ Error handling (404, 400, 500)
- ✅ DynamoDB integration (mocked)
- ✅ Response format validation
- ✅ Edge cases and validation errors
- ✅ Billing type validation (recurring vs one-time)
- ✅ Interval and frequency validation

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
   - `PRICES_TABLE`: Your DynamoDB table name

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
pricing-service/
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

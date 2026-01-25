# Unit Tests for Product Service Lambda Handler

This directory contains comprehensive unit tests for the Lambda handler that processes API Gateway events.

## Test Structure

### Test Files

- **`handler.test.ts`** - Main test suite for the Lambda handler
- **`helpers/api-gateway-event-factory.ts`** - Factory for creating API Gateway event fixtures
- **`helpers/product-fixtures.ts`** - Factory for creating Product test data
- **`setup.ts`** - Test setup and environment configuration

## Test Coverage

The tests cover all API Gateway routes:

1. **GET /products** - List products with pagination
   - Default pagination
   - Custom pagination parameters
   - Filtering by type
   - Filtering by active status

2. **GET /products/search** - Search products by name prefix
   - Name prefix filtering
   - Pagination support

3. **GET /products/{id}** - Get single product
   - Successful retrieval
   - 404 for non-existent products

4. **POST /products** - Create new product
   - Successful creation
   - Validation errors

5. **PUT /products/{id}** - Update product
   - Successful update
   - 404 for non-existent products

6. **DELETE /products/{id}** - Delete product
   - Successful deletion

7. **Error Handling**
   - Unknown routes (404)
   - DynamoDB errors (500)
   - Invalid JSON (400)
   - Domain validation errors (400)

## Mocking

### DynamoDB Mocking

The tests mock the AWS SDK DynamoDB client:
- `@aws-sdk/client-dynamodb` - DynamoDBClient
- `@aws-sdk/lib-dynamodb` - DynamoDBDocumentClient and commands

### Crypto Mocking

The `crypto.randomUUID()` function is mocked to return predictable UUIDs for testing.

## Running Tests

```bash
# Run all tests
pnpm run test

# Run tests in watch mode
pnpm run test:watch

# Run tests with coverage
pnpm run test:coverage
```

## Test Utilities

### ApiGatewayEventFactory

Helper class for creating API Gateway event objects:

```typescript
// Create GET event
const event = ApiGatewayEventFactory.createGetEvent('/products', {
  page_number: '1',
  page_size: '10'
});

// Create POST event
const event = ApiGatewayEventFactory.createPostEvent('/products', {
  name: 'Product Name',
  type: 'subscription',
  entitlements: ['feature.analytics']
});

// Create PUT event with path parameters
const event = ApiGatewayEventFactory.createPutEvent('/products/{id}', {
  name: 'Updated Name'
}, { id: 'prod-123' });

// Create DELETE event
const event = ApiGatewayEventFactory.createDeleteEvent('/products/{id}', {
  id: 'prod-123'
});
```

### ProductFixtures

Helper class for creating Product test data:

```typescript
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

## Example Test

```typescript
describe('GET /products - List Products', () => {
  it('should return paginated list of products', async () => {
    const products = ProductFixtures.createProductList(3);
    mockSend.mockResolvedValueOnce({
      Items: products,
      LastEvaluatedKey: undefined,
    });

    const event = ApiGatewayEventFactory.createGetEvent('/products', {
      page_number: '1',
      page_size: '10',
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('pagination');
  });
});
```

## Notes

- All DynamoDB operations are mocked
- Environment variables are set in `setup.ts`
- Tests are isolated and don't require actual AWS resources
- Response format matches the expected API structure with `amount`, `data`, and `pagination` fields

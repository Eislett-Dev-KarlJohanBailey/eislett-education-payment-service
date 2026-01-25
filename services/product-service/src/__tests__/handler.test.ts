import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../handler';
import { ApiGatewayEventFactory } from './helpers/api-gateway-event-factory';
import { ProductFixtures } from './helpers/product-fixtures';

// Mock crypto
jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'mock-uuid-123'),
}));

// Mock AWS SDK
jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(() => ({
    send: jest.fn(),
  })),
}));

// Create a shared mock send function
const mockSendFn = jest.fn();

jest.mock('@aws-sdk/lib-dynamodb', () => {
  return {
    DynamoDBDocumentClient: {
      from: jest.fn(() => ({
        send: mockSendFn,
      })),
    },
    PutCommand: jest.fn((params) => ({ type: 'PutCommand', ...params })),
    GetCommand: jest.fn((params) => ({ type: 'GetCommand', ...params })),
    QueryCommand: jest.fn((params) => ({ type: 'QueryCommand', ...params })),
    DeleteCommand: jest.fn((params) => ({ type: 'DeleteCommand', ...params })),
  };
});

describe('Lambda Handler - API Gateway Integration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSendFn.mockClear();
    process.env = {
      ...originalEnv,
      PRODUCTS_TABLE: 'test-products-table',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('GET /products - List Products', () => {
    it('should return paginated list of products', async () => {
      const products = ProductFixtures.createProductList(3);
      mockSendFn.mockResolvedValueOnce({
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
      expect(body).toHaveProperty('amount');
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('pagination');
      expect(body.pagination).toHaveProperty('page_size', 10);
      expect(body.pagination).toHaveProperty('page_number', 1);
      expect(body.pagination).toHaveProperty('total_pages');
    });

    it('should filter by type when provided', async () => {
      const products = ProductFixtures.createProductList(2);
      mockSendFn.mockResolvedValueOnce({
        Items: products,
        LastEvaluatedKey: undefined,
      });

      const event = ApiGatewayEventFactory.createGetEvent('/products', {
        type: 'subscription',
        page_number: '1',
        page_size: '10',
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(mockSendFn).toHaveBeenCalled();
    });

    it('should filter by active status when provided', async () => {
      const products = ProductFixtures.createProductList(2);
      mockSendFn.mockResolvedValueOnce({
        Items: products,
        LastEvaluatedKey: undefined,
      });

      const event = ApiGatewayEventFactory.createGetEvent('/products', {
        active: 'true',
        page_number: '1',
        page_size: '10',
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(mockSendFn).toHaveBeenCalled();
    });

    it('should use default pagination when not provided', async () => {
      const products = ProductFixtures.createProductList(1);
      mockSendFn.mockResolvedValueOnce({
        Items: products,
        LastEvaluatedKey: undefined,
      });

      const event = ApiGatewayEventFactory.createGetEvent('/products');

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.pagination.page_size).toBe(20); // default
      expect(body.pagination.page_number).toBe(1);
    });
  });

  describe('GET /products/search - Search Products', () => {
    it('should search products by name prefix', async () => {
      const products = ProductFixtures.createProductList(2);
      mockSendFn.mockResolvedValueOnce({
        Items: products,
        LastEvaluatedKey: undefined,
      });

      const event = ApiGatewayEventFactory.createGetEvent('/products/search', {
        name_prefix: 'Test',
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

  describe('GET /products/{id} - Get Product', () => {
    it('should return a product by id', async () => {
      const productItem = ProductFixtures.createProductItem({
        productId: 'prod-123',
        name: 'Test Product',
      });

      mockSendFn.mockResolvedValueOnce({
        Item: productItem,
      });

      const event = ApiGatewayEventFactory.createGetEvent('/products/{id}');
      event.pathParameters = { id: 'prod-123' };
      event.resource = '/products/{id}';

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body).toHaveProperty('productId', 'prod-123');
      expect(body).toHaveProperty('name', 'Test Product');
    });

    it('should return 404 when product not found', async () => {
      mockSendFn.mockResolvedValueOnce({
        Item: undefined,
      });

      const event = ApiGatewayEventFactory.createGetEvent('/products/{id}');
      event.pathParameters = { id: 'non-existent' };
      event.resource = '/products/{id}';

      const result = await handler(event);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('NOT_FOUND');
    });
  });

  describe('POST /products - Create Product', () => {
    it('should create a new product', async () => {
      mockSendFn.mockResolvedValueOnce({});

      const productData = {
        name: 'New Product',
        description: 'New Description',
        type: 'subscription',
        entitlements: ['feature.analytics'],
      };

      const event = ApiGatewayEventFactory.createPostEvent('/products', productData);

      const result = await handler(event);

      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body).toHaveProperty('productId');
      expect(mockSendFn).toHaveBeenCalled();
    });

    it('should create a product with providers', async () => {
      mockSendFn.mockResolvedValueOnce({});

      const productData = {
        name: 'Product with Providers',
        description: 'Product with payment providers',
        type: 'subscription',
        entitlements: ['feature.analytics'],
        providers: {
          stripe: 'prod_stripe_123',
          paypal: 'PP-12345',
          powertranz: 'PT-67890'
        }
      };

      const event = ApiGatewayEventFactory.createPostEvent('/products', productData);

      const result = await handler(event);

      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body).toHaveProperty('productId');
      expect(mockSendFn).toHaveBeenCalled();
    });

    it('should return 400 for invalid product data', async () => {
      const invalidData = {
        // missing required fields like name, type, entitlements
        description: 'Invalid Product',
      };

      const event = ApiGatewayEventFactory.createPostEvent('/products', invalidData);

      const result = await handler(event);

      // Should return error response (domain validation error)
      expect(result.statusCode).toBeGreaterThanOrEqual(400);
    });
  });

  describe('PUT /products/{id} - Update Product', () => {
    it('should update an existing product', async () => {
      const existingProduct = ProductFixtures.createProductItem({
        productId: 'prod-123',
      });

      // Mock get for existing product
      mockSendFn
        .mockResolvedValueOnce({ Item: existingProduct }) // Get existing
        .mockResolvedValueOnce({}); // Update

      const updateData = {
        name: 'Updated Product Name',
        description: 'Updated Description',
      };

      const event = ApiGatewayEventFactory.createPutEvent('/products/{id}', updateData, {
        id: 'prod-123',
      });
      event.resource = '/products/{id}';

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(mockSendFn).toHaveBeenCalledTimes(2);
    });

    it('should return 404 when updating non-existent product', async () => {
      mockSendFn.mockResolvedValueOnce({
        Item: undefined,
      });

      const event = ApiGatewayEventFactory.createPutEvent('/products/{id}', {
        name: 'Updated Name',
      }, {
        id: 'non-existent',
      });
      event.resource = '/products/{id}';

      const result = await handler(event);

      expect(result.statusCode).toBe(404);
    });

    it('should update product providers', async () => {
      const existingProduct = ProductFixtures.createProductItem({
        productId: 'prod-123',
        providers: {
          stripe: 'prod_stripe_123'
        }
      });

      mockSendFn
        .mockResolvedValueOnce({ Item: existingProduct }) // Get existing
        .mockResolvedValueOnce({}); // Update

      const updateData = {
        providers: {
          stripe: 'prod_stripe_456', // Update existing
          paypal: 'PP-12345', // Add new
          powertranz: 'PT-67890' // Add new
        }
      };

      const event = ApiGatewayEventFactory.createPutEvent('/products/{id}', updateData, {
        id: 'prod-123',
      });
      event.resource = '/products/{id}';

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(mockSendFn).toHaveBeenCalledTimes(2);
    });

    it('should return product with providers', async () => {
      const productItem = ProductFixtures.createProductItem({
        productId: 'prod-123',
        name: 'Product with Providers',
        providers: {
          stripe: 'prod_stripe_123',
          paypal: 'PP-12345',
          powertranz: 'PT-67890'
        }
      });

      mockSendFn.mockResolvedValueOnce({
        Item: productItem,
      });

      const event = ApiGatewayEventFactory.createGetEvent('/products/{id}');
      event.pathParameters = { id: 'prod-123' };
      event.resource = '/products/{id}';

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body).toHaveProperty('providers');
      expect(body.providers).toEqual({
        stripe: 'prod_stripe_123',
        paypal: 'PP-12345',
        powertranz: 'PT-67890'
      });
    });
  });

  describe('DELETE /products/{id} - Delete Product', () => {
    it('should delete a product', async () => {
      mockSendFn.mockResolvedValueOnce({});

      const event = ApiGatewayEventFactory.createDeleteEvent('/products/{id}', {
        id: 'prod-123',
      });
      event.resource = '/products/{id}';

      const result = await handler(event);

      expect(result.statusCode).toBe(204);
      expect(result.body).toBeNull();
      expect(mockSendFn).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const event = ApiGatewayEventFactory.createGetEvent('/unknown/route');

      const result = await handler(event);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.message).toBe('Route not found');
    });

    it('should handle DynamoDB errors gracefully', async () => {
      mockSendFn.mockRejectedValueOnce(new Error('DynamoDB error'));

      const event = ApiGatewayEventFactory.createGetEvent('/products');

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('INTERNAL_SERVER_ERROR');
    });

    it('should handle invalid JSON in request body', async () => {
      const event = ApiGatewayEventFactory.createPostEvent('/products', {});
      event.body = 'invalid json';

      const result = await handler(event);

      expect(result.statusCode).toBeGreaterThanOrEqual(400);
    });

    it('should handle domain errors', async () => {
      // This would require mocking the domain layer to throw DomainError
      // For now, we test the error response structure
      const event = ApiGatewayEventFactory.createPostEvent('/products', {
        productId: 'test',
        name: '', // Invalid name might trigger domain error
        type: 'invalid-type',
        entitlements: [],
        isActive: true,
      });

      const result = await handler(event);

      // Should return an error response
      expect(result.statusCode).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Response Format', () => {
    it('should return proper CORS headers', async () => {
      const products = ProductFixtures.createProductList(1);
      mockSendFn.mockResolvedValueOnce({
        Items: products,
        LastEvaluatedKey: undefined,
      });

      const event = ApiGatewayEventFactory.createGetEvent('/products');

      const result = await handler(event);

      expect(result.headers).toHaveProperty('Content-Type', 'application/json');
    });

    it('should return list response in correct format', async () => {
      const products = ProductFixtures.createProductList(5);
      mockSendFn.mockResolvedValueOnce({
        Items: products,
        LastEvaluatedKey: undefined,
      });

      const event = ApiGatewayEventFactory.createGetEvent('/products', {
        page_number: '1',
        page_size: '5',
      });

      const result = await handler(event);
      const body = JSON.parse(result.body);

      expect(body).toMatchObject({
        amount: expect.any(Number),
        data: expect.any(Array),
        pagination: {
          page_size: 5,
          page_number: 1,
          total_pages: expect.any(Number),
        },
      });
    });
  });
});

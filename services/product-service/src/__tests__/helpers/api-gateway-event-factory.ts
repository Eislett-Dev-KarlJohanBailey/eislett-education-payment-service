import { APIGatewayProxyEvent } from 'aws-lambda';

export class ApiGatewayEventFactory {
  static createEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
    const defaultEvent: APIGatewayProxyEvent = {
      httpMethod: 'GET',
      path: '/products',
      resource: '/products',
      headers: {
        'Content-Type': 'application/json',
      },
      multiValueHeaders: {},
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      pathParameters: null,
      stageVariables: null,
      requestContext: {
        accountId: '123456789012',
        apiId: 'test-api-id',
        authorizer: {},
        protocol: 'HTTP/1.1',
        httpMethod: 'GET',
        path: '/products',
        stage: 'test',
        requestId: 'test-request-id',
        requestTime: '09/Apr/2015:12:34:56 +0000',
        requestTimeEpoch: 1428582896000,
        identity: {
          accessKey: null,
          accountId: null,
          apiKey: null,
          apiKeyId: null,
          caller: null,
          clientCert: null,
          cognitoAuthenticationProvider: null,
          cognitoAuthenticationType: null,
          cognitoIdentityId: null,
          cognitoIdentityPoolId: null,
          principalOrgId: null,
          sourceIp: '127.0.0.1',
          user: null,
          userAgent: 'test-agent',
          userArn: null,
        },
        resourceId: 'test-resource-id',
        resourcePath: '/products',
      },
      body: null,
      isBase64Encoded: false,
    };

    return {
      ...defaultEvent,
      ...overrides,
      requestContext: {
        ...defaultEvent.requestContext,
        ...(overrides.requestContext || {}),
        identity: {
          ...defaultEvent.requestContext.identity,
          ...(overrides.requestContext?.identity || {}),
        },
      },
    };
  }

  static createGetEvent(path: string, queryParams?: Record<string, string>): APIGatewayProxyEvent {
    return this.createEvent({
      httpMethod: 'GET',
      path,
      resource: path,
      queryStringParameters: queryParams || null,
      requestContext: {
        httpMethod: 'GET',
        path,
        resourcePath: path,
      } as any,
    });
  }

  static createPostEvent(path: string, body: any): APIGatewayProxyEvent {
    return this.createEvent({
      httpMethod: 'POST',
      path,
      resource: path,
      body: JSON.stringify(body),
      requestContext: {
        httpMethod: 'POST',
        path,
        resourcePath: path,
      } as any,
    });
  }

  static createPutEvent(path: string, body: any, pathParams?: Record<string, string>): APIGatewayProxyEvent {
    return this.createEvent({
      httpMethod: 'PUT',
      path,
      resource: path.includes('{') ? path : path, // Keep resource template if it has {id}
      pathParameters: pathParams || null,
      body: JSON.stringify(body),
      requestContext: {
        httpMethod: 'PUT',
        path,
        resourcePath: path,
      } as any,
    });
  }

  static createDeleteEvent(path: string, pathParams?: Record<string, string>): APIGatewayProxyEvent {
    return this.createEvent({
      httpMethod: 'DELETE',
      path,
      resource: path.includes('{') ? path : path,
      pathParameters: pathParams || null,
      requestContext: {
        httpMethod: 'DELETE',
        path,
        resourcePath: path,
      } as any,
    });
  }
}

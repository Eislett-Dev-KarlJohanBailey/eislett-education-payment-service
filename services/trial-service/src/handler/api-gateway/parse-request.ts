import { APIGatewayProxyEvent } from "aws-lambda";
import { RequestContext } from "./types";

export function parseRequest(event: APIGatewayProxyEvent): RequestContext {
  // Use resource for route matching (contains template like /trial)
  const path = event.resource || event.path;
  
  let body = null;
  if (event.body) {
    try {
      body = JSON.parse(event.body);
    } catch (error) {
      // If body is not valid JSON, throw a clear error
      throw new Error(`Invalid JSON in request body: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  // Filter out undefined values from pathParams and query
  const pathParams: Record<string, string> = {};
  if (event.pathParameters) {
    for (const [key, value] of Object.entries(event.pathParameters)) {
      if (value !== undefined) {
        pathParams[key] = value;
      }
    }
  }
  
  const query: Record<string, string> = {};
  if (event.queryStringParameters) {
    for (const [key, value] of Object.entries(event.queryStringParameters)) {
      if (value !== undefined) {
        query[key] = value;
      }
    }
  }
  
  return {
    method: event.httpMethod,
    path: path,
    pathParams: pathParams,
    query: query,
    body: body
  };
}
